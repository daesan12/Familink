package com.ssafy.s15p11b104.domain.report.service;

import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIngestStatus;
import com.ssafy.s15p11b104.domain.call.entity.TranscriptIntegrityStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationRequest;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationRequestRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptEventRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallTranscriptRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.dto.CallReportResponse;
import com.ssafy.s15p11b104.domain.report.dto.CallReportStatus;
import com.ssafy.s15p11b104.domain.report.dto.CallReportStatusResponse;
import com.ssafy.s15p11b104.domain.report.dto.DailyCallItemResponse;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportGenerationStatus;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportResponse;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportSummaryResponse;
import com.ssafy.s15p11b104.domain.report.dto.ReportCalendarResponse;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportGenerationClaimRepository;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * 보호자가 피보호자의 통화 리포트를 조회하는 기능을 담당한다.
 *
 * <p>{@code API-REPORTS-001}~{@code 004}를 구현한다. 모든 계약은 같은 그룹의 활성 보호자만 허용하고
 * 404를 두지 않으므로, 존재하지 않는 그룹·구성원·통화도 {@code FORBIDDEN}으로 응답해 리소스 존재
 * 여부를 노출하지 않는다. 유일한 404는 통화에는 접근할 수 있으나 건별 리포트가 아직 없는
 * {@code CALL_REPORT_NOT_READY}다.
 */
@Service
public class ReportQueryService {

	private final DailyReportRepository dailyReportRepository;
	private final DailyReportGenerationClaimRepository claimRepository;
	private final CallSessionRepository callSessionRepository;
	private final CallReportCallRepository callReportRepository;
	private final CallReportGenerationRequestRepository callReportRequestRepository;
	private final CallTranscriptEventRepository transcriptEventRepository;
	private final CallTranscriptRepository callTranscriptRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final Clock clock;

	public ReportQueryService(
		DailyReportRepository dailyReportRepository,
		DailyReportGenerationClaimRepository claimRepository,
		CallSessionRepository callSessionRepository,
		CallReportCallRepository callReportRepository,
		CallReportGenerationRequestRepository callReportRequestRepository,
		CallTranscriptEventRepository transcriptEventRepository,
		CallTranscriptRepository callTranscriptRepository,
		GroupMemberRepository groupMemberRepository,
		Clock clock) {
		this.dailyReportRepository = dailyReportRepository;
		this.claimRepository = claimRepository;
		this.callSessionRepository = callSessionRepository;
		this.callReportRepository = callReportRepository;
		this.callReportRequestRepository = callReportRequestRepository;
		this.transcriptEventRepository = transcriptEventRepository;
		this.callTranscriptRepository = callTranscriptRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.clock = clock;
	}

	/**
	 * 한 달 중 일일 리포트가 있는 날짜를 반환한다.
	 */
	@Transactional(readOnly = true)
	public ReportCalendarResponse getCalendar(
		Long groupId, Long memberId, int year, int month, Long authenticatedUserId) {
		YearMonth yearMonth = resolveYearMonth(year, month);
		requireGuardianAccessToCareReceiver(groupId, memberId, authenticatedUserId);

		return new ReportCalendarResponse(
			yearMonth.toString(),
			dailyReportRepository.findReportDatesInRange(
				memberId, yearMonth.atDay(1), yearMonth.atEndOfMonth()),
			dailyReportRepository.findLatestReportDate(memberId).orElse(null));
	}

	/**
	 * 기준일의 일일 리포트와 그 구간에 종료된 통화 목록을 반환한다.
	 *
	 * <p>구간에 통화가 없어 일일 리포트를 만들지 않았으면 오류가 아니라 {@code dailyReport}가 비어
	 * 있는 빈 상태로 응답한다.
	 */
	@Transactional(readOnly = true)
	public DailyReportResponse getDailyReport(
		Long groupId, Long memberId, LocalDate reportDate, Long authenticatedUserId) {
		requireGuardianAccessToCareReceiver(groupId, memberId, authenticatedUserId);

		DailyReportSummaryResponse dailyReport = dailyReportRepository
			.findByCareReceiverMemberIdAndReportDate(memberId, reportDate)
			.map(this::toSummary)
			.orElse(null);
		List<DailyCallItemResponse> calls = findCalls(memberId, reportDate);

		return new DailyReportResponse(
			reportDate,
			resolveDailyReportGenerationStatus(memberId, reportDate, dailyReport, calls),
			dailyReport,
			calls);
	}

	private DailyReportGenerationStatus resolveDailyReportGenerationStatus(
		Long memberId,
		LocalDate reportDate,
		DailyReportSummaryResponse dailyReport,
		List<DailyCallItemResponse> calls
	) {
		if (dailyReport != null) {
			return DailyReportGenerationStatus.READY;
		}
		boolean isGenerating = claimRepository
			.findByCareReceiverMemberIdAndReportDate(memberId, reportDate)
			.filter(claim -> claim.isActiveAt(clock.instant()))
			.isPresent();
		if (isGenerating) {
			return DailyReportGenerationStatus.GENERATING;
		}
		return calls.stream().anyMatch(DailyCallItemResponse::reportAvailable)
			? DailyReportGenerationStatus.AVAILABLE
			: DailyReportGenerationStatus.NOT_READY;
	}

	/**
	 * 한 통화의 건별 리포트를 반환한다.
	 */
	@Transactional(readOnly = true)
	public CallReportResponse getCallReport(Long callSessionId, Long authenticatedUserId) {
		findAuthorizedCallSession(callSessionId, authenticatedUserId);

		CallReport report = callReportRepository.findByCallSessionId(callSessionId)
			.orElseThrow(() -> new BusinessException(ErrorCode.CALL_REPORT_NOT_READY));

		return new CallReportResponse(
			callSessionId,
			report.getSummary(),
			report.getGuardianMessage(),
			report.getCreatedAt());
	}

	/**
	 * 한 통화의 건별 리포트 생성 상태를 내부 처리 정보 없이 반환한다.
	 */
	@Transactional(readOnly = true)
	public CallReportStatusResponse getCallReportStatus(Long callSessionId, Long authenticatedUserId) {
		CallSession session = findAuthorizedCallSession(callSessionId, authenticatedUserId);
		return new CallReportStatusResponse(callSessionId, resolveCallReportStatus(session));
	}

	private CallReportStatus resolveCallReportStatus(CallSession session) {
		Long callSessionId = session.getId();
		if (callReportRepository.existsByCallSessionId(callSessionId)) {
			return CallReportStatus.READY;
		}

		CallReportGenerationRequest request = callReportRequestRepository.findById(callSessionId).orElse(null);
		if (request != null) {
			return switch (request.getStatus()) {
				case PENDING, CLAIMED -> CallReportStatus.GENERATING;
				case GEMINI_FAILED -> CallReportStatus.FAILED;
				case DONE -> CallReportStatus.UNAVAILABLE;
			};
		}

		if (session.getStatus() != CallStatus.COMPLETED) {
			return CallReportStatus.UNAVAILABLE;
		}
		if (session.getTranscriptIntegrityStatus() == TranscriptIntegrityStatus.COLLECTING) {
			return CallReportStatus.GENERATING;
		}
		if (session.getTranscriptIntegrityStatus() != TranscriptIntegrityStatus.RECONCILIATION_REQUIRED) {
			return CallReportStatus.UNAVAILABLE;
		}

		long unresolvedCount = transcriptEventRepository.countByCallSessionIdAndStatusNot(
			callSessionId,
			TranscriptIngestStatus.APPLIED
		);
		long readyCount = transcriptEventRepository.countByCallSessionIdAndStatus(
			callSessionId,
			TranscriptIngestStatus.READY
		);
		boolean hasMaterializedTranscript = callTranscriptRepository.countByCallSessionId(callSessionId) > 0;
		boolean canMaterializeReadyEvents = unresolvedCount > 0 && unresolvedCount == readyCount;
		boolean canFinalizeAppliedEvents = unresolvedCount == 0 && hasMaterializedTranscript;
		return canMaterializeReadyEvents || canFinalizeAppliedEvents
			? CallReportStatus.GENERATING
			: CallReportStatus.UNAVAILABLE;
	}

	private CallSession findAuthorizedCallSession(Long callSessionId, Long authenticatedUserId) {
		CallSession session = callSessionRepository.findById(callSessionId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		requireGuardianAccessToCareReceiver(
			session.getGroup().getId(),
			session.getCareReceiverMember().getId(),
			authenticatedUserId);
		return session;
	}

	/**
	 * 기준일 구간에 생성이 완료된 건별 리포트의 통화 목록을 만든다.
	 *
	 * <p>보호자 화면에는 저장된 건별 리포트만 노출하므로 생성 중이거나 생성에 실패한 통화는 목록에
	 * 포함하지 않는다.
	 */
	private List<DailyCallItemResponse> findCalls(Long memberId, LocalDate reportDate) {
		DailyReportWindow window = DailyReportWindow.forReportDate(reportDate);
		return callReportRepository.findCompletedForMemberInEndedAtRange(
				memberId, CallStatus.COMPLETED, window.startInclusive(), window.endExclusive())
			.stream()
			.map(report -> {
				CallSession session = report.getCallSession();
				return new DailyCallItemResponse(
					session.getId(),
					session.getStartedAt(),
					true);
			})
			.toList();
	}

	private DailyReportSummaryResponse toSummary(DailyReport report) {
		return new DailyReportSummaryResponse(
			report.getId(),
			report.getSummary(),
			report.getEmotionCategory(),
			report.getEmotionSubcategory(),
			report.getGuardianMessage());
	}

	/**
	 * 요청자가 그룹의 활성 보호자이고 대상이 같은 그룹의 활성 피보호자인지 확인한다.
	 *
	 * <p>AI 리포트는 보호자만 조회하므로 피보호자 본인도 자기 리포트를 볼 수 없다. 계약에 404가 없어
	 * 존재하지 않는 대상과 권한 없는 대상을 구분하지 않는다.
	 */
	private void requireGuardianAccessToCareReceiver(
		Long groupId, Long memberId, Long authenticatedUserId) {
		GroupMember requester = groupMemberRepository
			.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		if (requester.getRole() != GroupRole.GUARDIAN) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}

		GroupMember target = groupMemberRepository
			.findActiveByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		if (target.getRole() != GroupRole.CARE_RECEIVER) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
	}

	/**
	 * 달력 조회의 연·월을 검증한다.
	 *
	 * <p>범위를 벗어난 월은 본문 값의 문제이므로 계약이 정한 {@code INVALID_REQUEST}로 거부한다.
	 */
	private YearMonth resolveYearMonth(int year, int month) {
		try {
			return YearMonth.of(year, month);
		} catch (DateTimeException exception) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}
}
