package com.ssafy.s15p11b104.domain.call.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.EnumSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscript;
import com.ssafy.s15p11b104.domain.call.entity.CallTranscriptEvent;
import com.ssafy.s15p11b104.domain.call.entity.SpeakerType;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIngestStatus;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIntegrityStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationRequest;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationRequestRepository;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventClaimStore;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;

@Service
public class CallTranscriptService {

	private static final Logger LOGGER = LoggerFactory.getLogger(CallTranscriptService.class);
	private static final int BATCH_SIZE = 20;
	private static final int CLEANUP_BATCH_SIZE = 100;
	private static final int MAXIMUM_ATTEMPTS = 3;
	private static final Duration CLAIM_DURATION = Duration.ofSeconds(90);
	private static final Duration FINALIZATION_GRACE = Duration.ofSeconds(90);
	private static final Duration PAYLOAD_RETENTION = Duration.ofHours(24);
	private static final Set<CallStatus> TERMINAL_STATUSES = EnumSet.of(
		CallStatus.COMPLETED,
		CallStatus.INCOMPLETE,
		CallStatus.CANCELLED,
		CallStatus.FAILED
	);

	private final CallSessionRepository callSessionRepository;
	private final CallTranscriptRepository callTranscriptRepository;
	private final CallTranscriptEventRepository transcriptEventRepository;
	private final CallTranscriptEventClaimStore transcriptEventClaimStore;
	private final CallReportGenerationRequestRepository reportRequestRepository;
	private final CallReportCallRepository callReportRepository;
	private final TransactionTemplate transactionTemplate;
	private final Clock clock;

	public CallTranscriptService(
		CallSessionRepository callSessionRepository,
		CallTranscriptRepository callTranscriptRepository,
		CallTranscriptEventRepository transcriptEventRepository,
		CallTranscriptEventClaimStore transcriptEventClaimStore,
		CallReportGenerationRequestRepository reportRequestRepository,
		CallReportCallRepository callReportRepository,
		TransactionTemplate transactionTemplate,
		Clock clock
	) {
		this.callSessionRepository = callSessionRepository;
		this.callTranscriptRepository = callTranscriptRepository;
		this.transcriptEventRepository = transcriptEventRepository;
		this.transcriptEventClaimStore = transcriptEventClaimStore;
		this.reportRequestRepository = reportRequestRepository;
		this.callReportRepository = callReportRepository;
		this.transactionTemplate = transactionTemplate;
		this.clock = clock;
	}

	public TranscriptReservation reserveItem(Long callSessionId, SpeakerType speaker, String openaiItemId) {
		return transactionTemplate.execute(status -> reserveInTransaction(callSessionId, speaker, openaiItemId));
	}

	public boolean completeItem(
		Long callSessionId,
		SpeakerType speaker,
		String openaiItemId,
		String transcript
	) {
		String normalizedTranscript = transcript == null ? "" : transcript.strip();
		if (!StringUtils.hasText(normalizedTranscript)) {
			failItem(callSessionId, openaiItemId, "EMPTY_TRANSCRIPT");
			return false;
		}

		String contentHash = sha256(normalizedTranscript);
		ReadyPreparation preparation = transactionTemplate.execute(status -> prepareReadyInTransaction(
			callSessionId,
			speaker,
			openaiItemId,
			normalizedTranscript,
			contentHash
		));
		if (preparation == null || !preparation.accepted()) {
			return false;
		}
		if (preparation.eventId() == null) {
			return true;
		}

		ClaimedEvent claimedEvent = transactionTemplate.execute(status ->
			claimSpecificInTransaction(preparation.eventId()));
		if (claimedEvent == null) {
			return true;
		}
		return materializeClaimed(claimedEvent.eventId(), claimedEvent.claimToken());
	}

	public void failItem(Long callSessionId, String openaiItemId, String failureCode) {
		transactionTemplate.executeWithoutResult(status -> {
			CallSession session = findSessionForUpdate(callSessionId);
			CallTranscriptEvent event = StringUtils.hasText(openaiItemId)
				? transcriptEventRepository.findForUpdate(callSessionId, openaiItemId).orElse(null)
				: null;
			boolean changed = false;
			if (event != null && !event.isFailed()) {
				event.markFailed(limitFailureCode(failureCode));
				changed = true;
			}
			changed = session.requireTranscriptReconciliation() || changed;
			recordRevisionIfChanged(session, changed);
		});
	}

	public void failSession(Long callSessionId, String failureCode) {
		try {
			transactionTemplate.executeWithoutResult(status -> {
				CallSession session = findSessionForUpdate(callSessionId);
				boolean changed = session.requireTranscriptReconciliation();
				recordRevisionIfChanged(session, changed);
			});
		} catch (RuntimeException exception) {
			LOGGER.error(
				"전사 무결성 실패 상태를 기록하지 못했습니다. callSessionId={}, failureCode={}, errorType={}",
				callSessionId,
				limitFailureCode(failureCode),
				exception.getClass().getSimpleName()
			);
		}
	}

	public boolean finalizeSession(Long callSessionId, boolean drained) {
		return Boolean.TRUE.equals(transactionTemplate.execute(status ->
			finalizeInTransaction(callSessionId, drained, clock.instant())));
	}

	public void reconcileReady() {
		Instant now = clock.instant();
		failExpiredMaximumAttempts(now);
		UUID claimToken = UUID.randomUUID();
		List<Long> eventIds = transcriptEventClaimStore.claimReady(
			now,
			claimToken,
			now.plus(CLAIM_DURATION),
			BATCH_SIZE
		);
		for (Long eventId : eventIds) {
			materializeClaimed(eventId, claimToken);
		}
	}

	public void reconcileStaleFinalizations() {
		Instant now = clock.instant();
		Instant cutoff = now.minus(FINALIZATION_GRACE);
		List<Long> sessionIds = callSessionRepository.findTranscriptFinalizationCandidateIds(
			TERMINAL_STATUSES,
			TranscriptIntegrityStatus.COLLECTING,
			cutoff,
			PageRequest.of(0, BATCH_SIZE)
		);
		for (Long sessionId : sessionIds) {
			transactionTemplate.executeWithoutResult(status -> reconcileStaleSession(sessionId, cutoff, now));
		}
	}

	public void cleanupExpiredPayloads() {
		Instant cutoff = clock.instant().minus(PAYLOAD_RETENTION);
		List<Long> eventIds = transcriptEventRepository.findStalePayloadIds(
			EnumSet.of(TranscriptIngestStatus.READY, TranscriptIngestStatus.FAILED),
			cutoff,
			PageRequest.of(0, CLEANUP_BATCH_SIZE)
		);
		for (Long eventId : eventIds) {
			transactionTemplate.executeWithoutResult(status -> expirePayloadInTransaction(eventId, cutoff));
		}
	}

	public boolean saveIfAbsent(
		Long callSessionId,
		SpeakerType speaker,
		String content,
		int sequenceNumber,
		String openaiItemId
	) {
		return Boolean.TRUE.equals(transactionTemplate.execute(status -> {
			CallSession session = findSessionForUpdate(callSessionId);
			if (callTranscriptRepository.existsByCallSessionIdAndOpenaiItemId(callSessionId, openaiItemId)) {
				return false;
			}
			callTranscriptRepository.save(new CallTranscript(
				session,
				speaker,
				content,
				sequenceNumber,
				openaiItemId
			));
			session.recordTranscriptChange();
			return true;
		}));
	}

	private TranscriptReservation reserveInTransaction(
		Long callSessionId,
		SpeakerType speaker,
		String openaiItemId
	) {
		CallSession session = findSessionForUpdate(callSessionId);
		if (session.isTranscriptFinalized()) {
			boolean changed = session.requireTranscriptReconciliation();
			recordRevisionIfChanged(session, changed);
			return null;
		}

		CallTranscriptEvent existing = transcriptEventRepository
			.findForUpdate(callSessionId, openaiItemId)
			.orElse(null);
		if (existing != null) {
			if (existing.matchesReservation(speaker) && !existing.isFailed()) {
				return new TranscriptReservation(existing.getSequenceNumber());
			}
			boolean changed = false;
			if (!existing.isFailed()) {
				existing.markFailed("RESERVATION_MISMATCH");
				changed = true;
			}
			changed = session.requireTranscriptReconciliation() || changed;
			recordRevisionIfChanged(session, changed);
			return null;
		}

		int sequenceNumber = Math.max(
			transcriptEventRepository.findMaxSequenceNumber(callSessionId),
			callTranscriptRepository.findMaxSequenceNumber(callSessionId)
		) + 1;
		transcriptEventRepository.saveAndFlush(new CallTranscriptEvent(
			session,
			openaiItemId,
			speaker,
			sequenceNumber
		));
		session.recordTranscriptChange();
		return new TranscriptReservation(sequenceNumber);
	}

	private ReadyPreparation prepareReadyInTransaction(
		Long callSessionId,
		SpeakerType speaker,
		String openaiItemId,
		String transcript,
		String contentHash
	) {
		CallSession session = findSessionForUpdate(callSessionId);
		if (session.isTranscriptFinalized()) {
			boolean changed = session.requireTranscriptReconciliation();
			recordRevisionIfChanged(session, changed);
			return ReadyPreparation.rejected();
		}

		CallTranscriptEvent event = transcriptEventRepository
			.findForUpdate(callSessionId, openaiItemId)
			.orElse(null);
		if (event == null || !event.matchesReservation(speaker) || event.isFailed()) {
			boolean changed = false;
			if (event != null && !event.isFailed()) {
				event.markFailed("COMPLETION_MISMATCH");
				changed = true;
			}
			changed = session.requireTranscriptReconciliation() || changed;
			recordRevisionIfChanged(session, changed);
			return ReadyPreparation.rejected();
		}
		if (event.isApplied()) {
			if (event.hasContentHash(contentHash)) {
				return ReadyPreparation.noOp();
			}
			event.markFailed("CONTENT_HASH_MISMATCH");
			session.requireTranscriptReconciliation();
			session.recordTranscriptChange();
			return ReadyPreparation.rejected();
		}
		if (event.isReady()) {
			if (event.hasContentHash(contentHash)) {
				return ReadyPreparation.ready(event.getId());
			}
			event.markFailed("CONTENT_HASH_MISMATCH");
			session.requireTranscriptReconciliation();
			session.recordTranscriptChange();
			return ReadyPreparation.rejected();
		}

		event.markReady(transcript, contentHash, clock.instant());
		session.recordTranscriptChange();
		return ReadyPreparation.ready(event.getId());
	}

	private ClaimedEvent claimSpecificInTransaction(Long eventId) {
		CallTranscriptEvent candidate = transcriptEventRepository.findById(eventId).orElse(null);
		if (candidate == null) {
			return null;
		}
		Long callSessionId = candidate.getCallSession().getId();
		findSessionForUpdate(callSessionId);
		CallTranscriptEvent event = transcriptEventRepository.findByIdForUpdate(eventId).orElse(null);
		Instant now = clock.instant();
		if (event == null || !event.canClaim(now)) {
			return null;
		}
		UUID claimToken = UUID.randomUUID();
		event.claim(claimToken, now.plus(CLAIM_DURATION));
		return new ClaimedEvent(eventId, claimToken);
	}

	private boolean materializeClaimed(Long eventId, UUID claimToken) {
		try {
			return Boolean.TRUE.equals(transactionTemplate.execute(status ->
				materializeInTransaction(eventId, claimToken, clock.instant())));
		} catch (RuntimeException exception) {
			recordMaterializationFailure(eventId, claimToken, exception);
			return false;
		}
	}

	private boolean materializeInTransaction(Long eventId, UUID claimToken, Instant now) {
		CallTranscriptEvent candidate = transcriptEventRepository.findById(eventId).orElse(null);
		if (candidate == null) {
			return false;
		}
		Long callSessionId = candidate.getCallSession().getId();
		CallSession session = findSessionForUpdate(callSessionId);
		CallTranscriptEvent event = transcriptEventRepository.findByIdForUpdate(eventId).orElse(null);
		if (event == null || !event.ownsClaim(claimToken, now)) {
			return false;
		}

		CallTranscript existing = callTranscriptRepository
			.findByCallSessionIdAndOpenaiItemId(callSessionId, event.getOpenaiItemId())
			.orElse(null);
		if (existing != null) {
			if (!matchesTranscript(existing, event)) {
				event.markFailed("TRANSCRIPT_CONFLICT");
				session.requireTranscriptReconciliation();
				session.recordTranscriptChange();
				return false;
			}
		} else {
			callTranscriptRepository.saveAndFlush(new CallTranscript(
				session,
				event.getSpeaker(),
				event.getContent(),
				event.getSequenceNumber(),
				event.getOpenaiItemId()
			));
		}
		event.markApplied(now);
		session.recordTranscriptChange();
		finalizeRecoveredSession(session, now);
		return true;
	}

	private void recordMaterializationFailure(Long eventId, UUID claimToken, RuntimeException exception) {
		try {
			transactionTemplate.executeWithoutResult(status -> {
				CallTranscriptEvent candidate = transcriptEventRepository.findById(eventId).orElse(null);
				if (candidate == null) {
					return;
				}
				CallSession session = findSessionForUpdate(candidate.getCallSession().getId());
				CallTranscriptEvent event = transcriptEventRepository.findByIdForUpdate(eventId).orElse(null);
				Instant now = clock.instant();
				if (event == null || !event.ownsClaim(claimToken, now)) {
					return;
				}
				if (event.getAttemptCount() >= MAXIMUM_ATTEMPTS) {
					event.markFailed("MATERIALIZATION_FAILED");
					session.requireTranscriptReconciliation();
				} else {
					event.scheduleRetry(now.plus(retryDelay(event.getAttemptCount())));
				}
				session.recordTranscriptChange();
			});
		} catch (RuntimeException persistenceException) {
			LOGGER.error(
				"전사 재처리 실패 상태를 기록하지 못했습니다. eventId={}, errorType={}, recordErrorType={}",
				eventId,
				exception.getClass().getSimpleName(),
				persistenceException.getClass().getSimpleName()
			);
		}
	}

	private boolean finalizeInTransaction(Long callSessionId, boolean drained, Instant now) {
		CallSession session = findSessionForUpdate(callSessionId);
		if (session.isTranscriptComplete()) {
			return false;
		}
		if (!drained) {
			boolean changed = session.requireTranscriptReconciliation();
			recordRevisionIfChanged(session, changed);
			return false;
		}
		long unresolvedCount = transcriptEventRepository.countByCallSessionIdAndStatusNot(
			callSessionId,
			TranscriptIngestStatus.APPLIED
		);
		if (unresolvedCount > 0) {
			boolean changed = session.requireTranscriptReconciliationAfterDrain(now);
			recordRevisionIfChanged(session, changed);
			return false;
		}

		boolean changed = session.finalizeTranscript(now);
		recordRevisionIfChanged(session, changed);
		return ensureReportGenerationRequest(session);
	}

	private void finalizeRecoveredSession(CallSession session, Instant now) {
		if (session.getTranscriptIntegrityStatus() != TranscriptIntegrityStatus.RECONCILIATION_REQUIRED
			|| !session.isTranscriptFinalized()) {
			return;
		}
		transcriptEventRepository.flush();
		if (transcriptEventRepository.countByCallSessionIdAndStatusNot(
			session.getId(),
			TranscriptIngestStatus.APPLIED
		) > 0) {
			return;
		}

		Instant finalizedAt = session.getTranscriptFinalizedAt();
		boolean changed = session.finalizeTranscript(finalizedAt == null ? now : finalizedAt);
		recordRevisionIfChanged(session, changed);
		ensureReportGenerationRequest(session);
	}

	private boolean ensureReportGenerationRequest(CallSession session) {
		Long callSessionId = session.getId();
		if (session.getStatus() != CallStatus.COMPLETED
			|| callTranscriptRepository.countByCallSessionId(callSessionId) == 0
			|| callReportRepository.existsByCallSessionId(callSessionId)) {
			return false;
		}

		CallReportGenerationRequest request = reportRequestRepository
			.findByIdForUpdate(callSessionId)
			.orElse(null);
		if (request == null) {
			reportRequestRepository.save(new CallReportGenerationRequest(
				callSessionId,
				session.getTranscriptRevision()
			));
			return true;
		}
		return request.getStatus() == CallReportGenerationStatus.PENDING;
	}

	private void failExpiredMaximumAttempts(Instant now) {
		List<Long> eventIds = transcriptEventRepository.findExhaustedClaimIds(
			TranscriptIngestStatus.READY,
			MAXIMUM_ATTEMPTS,
			now,
			PageRequest.of(0, BATCH_SIZE)
		);
		for (Long eventId : eventIds) {
			transactionTemplate.executeWithoutResult(status -> {
				CallTranscriptEvent candidate = transcriptEventRepository.findById(eventId).orElse(null);
				if (candidate == null) {
					return;
				}
				CallSession session = findSessionForUpdate(candidate.getCallSession().getId());
				CallTranscriptEvent event = transcriptEventRepository.findByIdForUpdate(eventId).orElse(null);
				if (event == null
					|| !event.isReady()
					|| event.getAttemptCount() < MAXIMUM_ATTEMPTS
					|| event.getClaimExpiresAt() == null
					|| event.getClaimExpiresAt().isAfter(now)) {
					return;
				}
				event.markFailed("CLAIM_EXHAUSTED");
				session.requireTranscriptReconciliation();
				session.recordTranscriptChange();
			});
		}
	}

	private void reconcileStaleSession(Long sessionId, Instant cutoff, Instant now) {
		CallSession session = callSessionRepository.findByIdForUpdate(sessionId).orElse(null);
		if (session == null
			|| session.getTranscriptIntegrityStatus() != TranscriptIntegrityStatus.COLLECTING
			|| session.getTranscriptFinalizedAt() != null
			|| session.getEndedAt() == null
			|| session.getEndedAt().isAfter(cutoff)
			|| !TERMINAL_STATUSES.contains(session.getStatus())) {
			return;
		}
		long unresolvedCount = transcriptEventRepository.countByCallSessionIdAndStatusNot(
			sessionId,
			TranscriptIngestStatus.APPLIED
		);
		if ((session.getStatus() == CallStatus.CANCELLED || session.getStatus() == CallStatus.FAILED)
			&& unresolvedCount == 0) {
			recordRevisionIfChanged(session, session.finalizeTranscript(now));
			return;
		}
		recordRevisionIfChanged(session, session.requireTranscriptReconciliation());
	}

	private void expirePayloadInTransaction(Long eventId, Instant cutoff) {
		CallTranscriptEvent candidate = transcriptEventRepository.findById(eventId).orElse(null);
		if (candidate == null || candidate.getCreatedAt().isAfter(cutoff)) {
			return;
		}
		CallSession session = findSessionForUpdate(candidate.getCallSession().getId());
		CallTranscriptEvent event = transcriptEventRepository.findByIdForUpdate(eventId).orElse(null);
		if (event == null || event.getCreatedAt().isAfter(cutoff)) {
			return;
		}
		if (event.isReady()) {
			event.markFailed("PAYLOAD_RETENTION_EXPIRED");
			session.requireTranscriptReconciliation();
			session.recordTranscriptChange();
		} else if (event.isFailed()) {
			event.clearPayload();
		}
	}

	private CallSession findSessionForUpdate(Long callSessionId) {
		return callSessionRepository.findByIdForUpdate(callSessionId)
			.orElseThrow(() -> new IllegalStateException("전사를 처리할 통화 세션을 찾을 수 없습니다."));
	}

	private boolean matchesTranscript(CallTranscript transcript, CallTranscriptEvent event) {
		return transcript.getSpeaker() == event.getSpeaker()
			&& transcript.getSequenceNumber() == event.getSequenceNumber()
			&& Objects.equals(transcript.getContent(), event.getContent());
	}

	private void recordRevisionIfChanged(CallSession session, boolean changed) {
		if (changed) {
			session.recordTranscriptChange();
		}
	}

	private Duration retryDelay(int attemptCount) {
		return attemptCount <= 1 ? Duration.ofMinutes(1) : Duration.ofMinutes(2);
	}

	private String sha256(String content) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			return HexFormat.of().formatHex(digest.digest(content.getBytes(StandardCharsets.UTF_8)));
		} catch (NoSuchAlgorithmException exception) {
			throw new IllegalStateException("SHA-256을 사용할 수 없습니다.", exception);
		}
	}

	private String limitFailureCode(String failureCode) {
		String value = StringUtils.hasText(failureCode) ? failureCode : "UNKNOWN_FAILURE";
		return value.length() <= 80 ? value : value.substring(0, 80);
	}

	public record TranscriptReservation(int sequenceNumber) {
	}

	private record ClaimedEvent(Long eventId, UUID claimToken) {
	}

	private record ReadyPreparation(Long eventId, boolean accepted) {

		private static ReadyPreparation ready(Long eventId) {
			return new ReadyPreparation(eventId, true);
		}

		private static ReadyPreparation noOp() {
			return new ReadyPreparation(null, true);
		}

		private static ReadyPreparation rejected() {
			return new ReadyPreparation(null, false);
		}
	}
}
