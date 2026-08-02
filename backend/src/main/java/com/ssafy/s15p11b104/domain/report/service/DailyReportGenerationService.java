package com.ssafy.s15p11b104.domain.report.service;

import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.entity.DailyReportGenerationClaim;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportGenerationClaimRepository;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@Service
public class DailyReportGenerationService {

	private static final Logger LOGGER = LoggerFactory.getLogger(DailyReportGenerationService.class);
	static final Duration CLAIM_LEASE = Duration.ofSeconds(90);

	private final CallReportCallRepository callReportRepository;
	private final CallSessionRepository callSessionRepository;
	private final DailyReportRepository dailyReportRepository;
	private final DailyReportGenerationClaimRepository claimRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final DailyReportAnalyzer analyzer;
	private final TransactionTemplate transactionTemplate;
	private final ApplicationEventPublisher eventPublisher;
	private final Clock clock;

	public DailyReportGenerationService(
		CallReportCallRepository callReportRepository,
		CallSessionRepository callSessionRepository,
		DailyReportRepository dailyReportRepository,
		DailyReportGenerationClaimRepository claimRepository,
		GroupMemberRepository groupMemberRepository,
		DailyReportAnalyzer analyzer,
		TransactionTemplate transactionTemplate,
		ApplicationEventPublisher eventPublisher,
		Clock clock
	) {
		this.callReportRepository = callReportRepository;
		this.callSessionRepository = callSessionRepository;
		this.dailyReportRepository = dailyReportRepository;
		this.claimRepository = claimRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.analyzer = analyzer;
		this.transactionTemplate = transactionTemplate;
		this.eventPublisher = eventPublisher;
		this.clock = clock;
	}

	public void generate(LocalDate reportDate) {
		Objects.requireNonNull(reportDate, "reportDate must not be null");
		DailyReportWindow window = DailyReportWindow.forReportDate(reportDate);
		Set<Long> membersWithMissingReports = findMembersWithMissingReports(window);
		Map<Long, List<CallReport>> reportsByMember = callReportRepository
			.findCompletedInEndedAtRange(CallStatus.COMPLETED, window.startInclusive(), window.endExclusive())
			.stream()
			.collect(Collectors.groupingBy(
				report -> report.getCallSession().getCareReceiverMember().getId(),
				LinkedHashMap::new,
				Collectors.toList()
			));

		for (Long careReceiverMemberId : reportsByMember.keySet()) {
			if (!membersWithMissingReports.contains(careReceiverMemberId)) {
				generateForMember(reportDate, careReceiverMemberId, window);
			}
		}
	}

	private void generateForMember(
		LocalDate reportDate,
		Long careReceiverMemberId,
		DailyReportWindow window
	) {
		UUID token = UUID.randomUUID();
		ClaimedInput claimedInput = acquireOrRenew(reportDate, careReceiverMemberId, window, token);
		while (claimedInput != null) {
			DailyReportAnalysis analysis;
			try {
				analysis = analyzer.analyze(claimedInput.snapshot().input());
			} catch (RuntimeException exception) {
				logFailure(reportDate, careReceiverMemberId, exception);
				return;
			}

			FinalizeResult result = finalizeReport(
				reportDate, careReceiverMemberId, window, token, claimedInput.snapshot(), analysis);
			if (result != FinalizeResult.STALE_INPUT) {
				return;
			}
			claimedInput = acquireOrRenew(reportDate, careReceiverMemberId, window, token);
		}
	}

	private ClaimedInput acquireOrRenew(
		LocalDate reportDate,
		Long careReceiverMemberId,
		DailyReportWindow window,
		UUID token
	) {
		return transactionTemplate.execute(status -> {
			GroupMember member = groupMemberRepository.findByIdForUpdate(careReceiverMemberId).orElse(null);
			if (member == null
				|| dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(
					careReceiverMemberId, reportDate)
				|| findMembersWithMissingReports(window).contains(careReceiverMemberId)) {
				return null;
			}

			InputSnapshot snapshot = loadSnapshot(careReceiverMemberId, window);
			if (snapshot == null) {
				return null;
			}
			var existing = claimRepository.findForUpdate(careReceiverMemberId, reportDate);
			var now = clock.instant();
			if (existing.isPresent() && !existing.get().isAvailableTo(token, now)) {
				return null;
			}

			DailyReportGenerationClaim claim = existing.orElseGet(() -> new DailyReportGenerationClaim(
				careReceiverMemberId,
				reportDate,
				token,
				now.plus(CLAIM_LEASE),
				snapshot.count(),
				snapshot.latestReportId()));
			claim.renew(token, now.plus(CLAIM_LEASE), snapshot.count(), snapshot.latestReportId());
			claimRepository.save(claim);
			return new ClaimedInput(snapshot);
		});
	}

	private FinalizeResult finalizeReport(
		LocalDate reportDate,
		Long careReceiverMemberId,
		DailyReportWindow window,
		UUID token,
		InputSnapshot expected,
		DailyReportAnalysis analysis
	) {
		FinalizeResult result = transactionTemplate.execute(status -> {
			GroupMember member = groupMemberRepository.findByIdForUpdate(careReceiverMemberId).orElse(null);
			if (member == null) {
				return FinalizeResult.STOP;
			}
			DailyReportGenerationClaim claim = claimRepository
				.findForUpdate(careReceiverMemberId, reportDate)
				.orElse(null);
			if (claim == null || !claim.owns(
				token, expected.count(), expected.latestReportId(), clock.instant())) {
				return FinalizeResult.STOP;
			}
			if (dailyReportRepository.existsByCareReceiverMemberIdAndReportDate(
				careReceiverMemberId, reportDate)) {
				claimRepository.delete(claim);
				return FinalizeResult.STOP;
			}
			if (findMembersWithMissingReports(window).contains(careReceiverMemberId)) {
				return FinalizeResult.STOP;
			}

			InputSnapshot actual = loadSnapshot(careReceiverMemberId, window);
			if (actual == null || !expected.sameVersion(actual)) {
				return actual == null ? FinalizeResult.STOP : FinalizeResult.STALE_INPUT;
			}

			DailyReport report = new DailyReport(
				member.getGroup(),
				member,
				reportDate,
				analysis.summary(),
				analysis.emotionCategory(),
				analysis.emotionSubcategory(),
				analysis.guardianMessage());
			dailyReportRepository.save(report);
			claimRepository.delete(claim);
			eventPublisher.publishEvent(new DomainNotificationEvent.DailyReportCreated(report.getId()));
			return FinalizeResult.SAVED;
		});
		return result == null ? FinalizeResult.STOP : result;
	}

	private Set<Long> findMembersWithMissingReports(DailyReportWindow window) {
		return callSessionRepository
			.findCareReceiverMemberIdsWithCompletedWithoutReportInEndedAtRange(
				CallStatus.COMPLETED, window.startInclusive(), window.endExclusive())
			.stream()
			.collect(Collectors.toSet());
	}

	private InputSnapshot loadSnapshot(Long careReceiverMemberId, DailyReportWindow window) {
		List<CallReport> reports = callReportRepository.findCompletedForMemberInEndedAtRange(
			careReceiverMemberId,
			CallStatus.COMPLETED,
			window.startInclusive(),
			window.endExclusive());
		if (reports.isEmpty()) {
			return null;
		}
		long latestReportId = reports.stream()
			.map(CallReport::getId)
			.filter(Objects::nonNull)
			.mapToLong(Long::longValue)
			.max()
			.orElseThrow(() -> new IllegalStateException("Persisted call report id is required"));
		DailyReportInput input = new DailyReportInput(reports.stream()
			.map(report -> new DailyReportInput.CallReportContext(
				report.getSummary(), report.getGuardianMessage()))
			.toList());
		return new InputSnapshot(input, reports.size(), latestReportId);
	}

	private void logFailure(LocalDate reportDate, Long careReceiverMemberId, RuntimeException exception) {
		LOGGER.error(
			"일일 리포트 생성에 실패했습니다. reportDate={}, careReceiverMemberId={}, errorType={}",
			reportDate,
			careReceiverMemberId,
			exception.getClass().getSimpleName()
		);
	}

	private enum FinalizeResult {
		SAVED,
		STALE_INPUT,
		STOP
	}

	private record ClaimedInput(InputSnapshot snapshot) {
	}

	private record InputSnapshot(DailyReportInput input, int count, long latestReportId) {

		private boolean sameVersion(InputSnapshot other) {
			return count == other.count && latestReportId == other.latestReportId;
		}
	}
}
