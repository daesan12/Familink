package com.ssafy.s15p11b104.domain.report.service;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.stereotype.Service;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportGenerationResponse;
import com.ssafy.s15p11b104.domain.report.dto.DailyReportGenerationStatus;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class DailyReportManualGenerationService {

	private final GroupMemberRepository groupMemberRepository;
	private final DailyReportGenerationService generationService;
	private final DailyReportGenerationDispatcher dispatcher;
	private final Clock clock;

	public DailyReportManualGenerationService(
		GroupMemberRepository groupMemberRepository,
		DailyReportGenerationService generationService,
		DailyReportGenerationDispatcher dispatcher,
		Clock clock
	) {
		this.groupMemberRepository = groupMemberRepository;
		this.generationService = generationService;
		this.dispatcher = dispatcher;
		this.clock = clock;
	}

	public DailyReportGenerationResponse request(
		Long groupId,
		Long memberId,
		Long authenticatedUserId
	) {
		requireGuardianAccessToCareReceiver(groupId, memberId, authenticatedUserId);
		LocalDate reportDate = LocalDate.now(clock.withZone(DailyReportWindow.REPORT_ZONE));
		DailyReportGenerationService.ManualClaim claim = generationService.claimManual(
			reportDate, memberId);
		if (claim.status() == DailyReportGenerationStatus.NOT_READY) {
			throw new BusinessException(ErrorCode.DAILY_REPORT_INPUT_NOT_READY);
		}
		if (claim.needsDispatch()
			&& !dispatcher.dispatchManual(reportDate, memberId, claim.token())) {
			generationService.releaseManualClaim(reportDate, memberId, claim.token());
			throw new BusinessException(ErrorCode.DAILY_REPORT_GENERATION_BUSY);
		}
		return new DailyReportGenerationResponse(reportDate, claim.status());
	}

	private void requireGuardianAccessToCareReceiver(
		Long groupId,
		Long memberId,
		Long authenticatedUserId
	) {
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
}
