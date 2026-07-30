package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.call.dto.AiCallDevReportResponse;
import com.ssafy.s15p11b104.domain.call.dto.AiCallDevReportResponse.ReportStatus;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

@ExtendWith(MockitoExtension.class)
class AiCallDevReportServiceTest {

	private static final long CALL_SESSION_ID = 3L;
	private static final long CARE_RECEIVER_MEMBER_ID = 7L;

	@Mock
	private CallActorResolver callActorResolver;

	@Mock
	private CallSessionRepository callSessionRepository;

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private CallSession callSession;

	@Mock
	private CallReport callReport;

	private AiCallDevReportService reportService;

	@BeforeEach
	void setUp() {
		reportService = new AiCallDevReportService(
			callActorResolver,
			callSessionRepository,
			callReportRepository
		);
		when(callActorResolver.resolve()).thenReturn(new CallActor(CARE_RECEIVER_MEMBER_ID));
	}

	@Test
	void returnsReadyReport() {
		Instant createdAt = Instant.parse("2026-07-30T04:15:04Z");
		when(callSessionRepository.findByIdAndCareReceiverMemberId(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(callSession));
		when(callReportRepository.findByCallSessionId(CALL_SESSION_ID)).thenReturn(Optional.of(callReport));
		when(callReport.getCallSession()).thenReturn(callSession);
		when(callSession.getId()).thenReturn(CALL_SESSION_ID);
		when(callReport.getSummary()).thenReturn("가족과 건강 이야기를 나누며 편안하게 통화를 마쳤습니다.");
		when(callReport.getEmotionCategory()).thenReturn(EmotionCategory.JOY);
		when(callReport.getEmotionSubcategory()).thenReturn("기쁨");
		when(callReport.getGuardianMessage()).thenReturn("주말에 가족과 함께 식사하고 싶어 하십니다.");
		when(callReport.getCreatedAt()).thenReturn(createdAt);

		AiCallDevReportResponse response = reportService.get(CALL_SESSION_ID);

		assertThat(response.callSessionId()).isEqualTo(CALL_SESSION_ID);
		assertThat(response.reportStatus()).isEqualTo(ReportStatus.READY);
		assertThat(response.summary()).isEqualTo("가족과 건강 이야기를 나누며 편안하게 통화를 마쳤습니다.");
		assertThat(response.emotionCategory()).isEqualTo(EmotionCategory.JOY);
		assertThat(response.emotionSubcategory()).isEqualTo("기쁨");
		assertThat(response.guardianMessage()).isEqualTo("주말에 가족과 함께 식사하고 싶어 하십니다.");
		assertThat(response.createdAt()).isEqualTo(createdAt);
	}

	@Test
	void returnsPendingForCompletedCallWithoutReport() {
		when(callSessionRepository.findByIdAndCareReceiverMemberId(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(callSession));
		when(callReportRepository.findByCallSessionId(CALL_SESSION_ID)).thenReturn(Optional.empty());
		when(callSession.getStatus()).thenReturn(CallStatus.COMPLETED);

		AiCallDevReportResponse response = reportService.get(CALL_SESSION_ID);

		assertThat(response.reportStatus()).isEqualTo(ReportStatus.PENDING);
		assertThat(response.summary()).isNull();
		assertThat(response.createdAt()).isNull();
	}

	@Test
	void returnsNotApplicableForCallThatDidNotComplete() {
		when(callSessionRepository.findByIdAndCareReceiverMemberId(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.of(callSession));
		when(callReportRepository.findByCallSessionId(CALL_SESSION_ID)).thenReturn(Optional.empty());
		when(callSession.getStatus()).thenReturn(CallStatus.CANCELLED);

		AiCallDevReportResponse response = reportService.get(CALL_SESSION_ID);

		assertThat(response.reportStatus()).isEqualTo(ReportStatus.NOT_APPLICABLE);
	}

	@Test
	void rejectsSessionOwnedByAnotherCareReceiver() {
		when(callSessionRepository.findByIdAndCareReceiverMemberId(CALL_SESSION_ID, CARE_RECEIVER_MEMBER_ID))
			.thenReturn(Optional.empty());

		assertThatThrownBy(() -> reportService.get(CALL_SESSION_ID))
			.isInstanceOf(CallApiException.class)
			.hasMessage("통화 세션을 찾을 수 없습니다.");
	}
}
