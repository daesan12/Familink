package com.ssafy.s15p11b104.domain.call.report;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIngestStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportInput.TranscriptLine;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.domain.report.service.DailyReportGenerationDispatcher;
import com.ssafy.s15p11b104.domain.report.service.DailyReportWindow;

@Service
public class CallReportGenerationService {

	private static final Duration CLAIM_DURATION = Duration.ofSeconds(90);
	private static final String ANALYSIS_FAILURE_CODE = "ANALYSIS_FAILED";

	private final CallSessionRepository callSessionRepository;
	private final CallTranscriptRepository callTranscriptRepository;
	private final CallTranscriptEventRepository transcriptEventRepository;
	private final CallReportCallRepository callReportRepository;
	private final CallReportGenerationRequestRepository requestRepository;
	private final CallReportAnalyzer analyzer;
	private final DemoCallReportFixtureProvider demoFixtureProvider;
	private final DailyReportGenerationDispatcher dailyReportGenerationDispatcher;
	private final Clock applicationClock;
	private final TransactionTemplate transactionTemplate;
	private final ApplicationEventPublisher eventPublisher;

	public CallReportGenerationService(
		CallSessionRepository callSessionRepository,
		CallTranscriptRepository callTranscriptRepository,
		CallTranscriptEventRepository transcriptEventRepository,
		CallReportCallRepository callReportRepository,
		CallReportGenerationRequestRepository requestRepository,
		CallReportAnalyzer analyzer,
		DemoCallReportFixtureProvider demoFixtureProvider,
		DailyReportGenerationDispatcher dailyReportGenerationDispatcher,
		Clock applicationClock,
		TransactionTemplate transactionTemplate,
		ApplicationEventPublisher eventPublisher
	) {
		this.callSessionRepository = callSessionRepository;
		this.callTranscriptRepository = callTranscriptRepository;
		this.transcriptEventRepository = transcriptEventRepository;
		this.callReportRepository = callReportRepository;
		this.requestRepository = requestRepository;
		this.analyzer = analyzer;
		this.demoFixtureProvider = demoFixtureProvider;
		this.dailyReportGenerationDispatcher = dailyReportGenerationDispatcher;
		this.applicationClock = applicationClock;
		this.transactionTemplate = transactionTemplate;
		this.eventPublisher = eventPublisher;
	}

	public void generate(Long callSessionId) {
		UUID claimToken = UUID.randomUUID();
		GenerationTarget target = transactionTemplate.execute(status -> claimTarget(callSessionId, claimToken));
		if (target == null) {
			return;
		}

		CallReportAnalysis analysis;
		try {
			analysis = demoFixtureProvider
				.resolve(target.careReceiverLoginId())
				.orElseGet(() -> analyzer.analyze(target.input()));
		} catch (RuntimeException exception) {
			transactionTemplate.executeWithoutResult(status -> markGeminiFailed(target, ANALYSIS_FAILURE_CODE));
			return;
		}

		CallSession savedSession = transactionTemplate.execute(status -> finalizeIfCurrent(target, analysis));
		if (savedSession != null && savedSession.getEndedAt() != null) {
			var reportDate = DailyReportWindow.reportDateForEndedAt(savedSession.getEndedAt());
			var reportWindow = DailyReportWindow.forReportDate(reportDate);
			if (!applicationClock.instant().isBefore(reportWindow.endExclusive())) {
				dailyReportGenerationDispatcher.dispatch(reportDate);
			}
		}
	}

	private GenerationTarget claimTarget(Long callSessionId, UUID claimToken) {
		Instant now = applicationClock.instant();
		CallSession session = callSessionRepository.findByIdForUpdate(callSessionId).orElse(null);
		if (session == null) {
			return null;
		}
		CallReportGenerationRequest request = requestRepository.findByIdForUpdate(callSessionId).orElse(null);
		if (request == null) {
			return null;
		}
		if (callReportRepository.existsByCallSessionId(callSessionId)) {
			request.markDone();
			return null;
		}
		if (!isEligible(session)
			|| hasUnresolvedTranscriptEvents(callSessionId)
			|| !request.isClaimable(now)) {
			return null;
		}

		List<TranscriptLine> transcripts = callTranscriptRepository
			.findAllByCallSessionIdOrderBySequenceNumberAsc(callSessionId)
			.stream()
			.filter(transcript -> StringUtils.hasText(transcript.getContent()))
			.map(transcript -> new TranscriptLine(
				transcript.getSequenceNumber(),
				transcript.getSpeaker(),
				transcript.getContent()
			))
			.toList();
		if (transcripts.isEmpty()) {
			return null;
		}

		long revision = session.getTranscriptRevision();
		request.claim(claimToken, revision, now.plus(CLAIM_DURATION));
		return new GenerationTarget(
			callSessionId,
			revision,
			claimToken,
			session.getCareReceiverMember().getUser().getLoginId(),
			new CallReportInput(transcripts)
		);
	}

	private void markGeminiFailed(GenerationTarget target, String failureCode) {
		Instant now = applicationClock.instant();
		CallSession session = callSessionRepository.findByIdForUpdate(target.callSessionId()).orElse(null);
		if (session == null) {
			return;
		}
		CallReportGenerationRequest request = requestRepository
			.findByIdForUpdate(target.callSessionId())
			.orElse(null);
		if (request != null
			&& request.ownsClaim(target.claimToken(), target.revision(), now)
			&& isEligible(session)
			&& session.getTranscriptRevision() == target.revision()
			&& !hasUnresolvedTranscriptEvents(target.callSessionId())) {
			request.markGeminiFailed(failureCode, now);
		}
	}

	private CallSession finalizeIfCurrent(GenerationTarget target, CallReportAnalysis analysis) {
		Instant now = applicationClock.instant();
		CallSession session = callSessionRepository.findByIdForUpdate(target.callSessionId()).orElse(null);
		if (session == null) {
			return null;
		}
		CallReportGenerationRequest request = requestRepository
			.findByIdForUpdate(target.callSessionId())
			.orElse(null);
		if (request == null
			|| !request.ownsClaim(target.claimToken(), target.revision(), now)
			|| !isEligible(session)
			|| session.getTranscriptRevision() != target.revision()
			|| hasUnresolvedTranscriptEvents(target.callSessionId())) {
			return null;
		}
		if (callReportRepository.existsByCallSessionId(target.callSessionId())) {
			request.markDone();
			return null;
		}

		CallReport report = new CallReport(
			session,
			analysis.summary(),
			analysis.emotionCategory(),
			analysis.emotionSubcategory(),
			analysis.guardianMessage());
		callReportRepository.saveAndFlush(report);
		request.markDone();
		eventPublisher.publishEvent(new DomainNotificationEvent.CallReportCreated(report.getId()));
		return session;
	}

	private boolean isEligible(CallSession session) {
		return session.getStatus() == CallStatus.COMPLETED && session.isTranscriptComplete();
	}

	private boolean hasUnresolvedTranscriptEvents(Long callSessionId) {
		return transcriptEventRepository.countByCallSessionIdAndStatusNot(
			callSessionId,
			TranscriptIngestStatus.APPLIED
		) > 0;
	}

	private record GenerationTarget(
		Long callSessionId,
		long revision,
		UUID claimToken,
		String careReceiverLoginId,
		CallReportInput input
	) {
	}
}
