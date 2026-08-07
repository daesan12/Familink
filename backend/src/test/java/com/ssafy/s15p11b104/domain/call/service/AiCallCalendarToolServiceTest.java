package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListResponse;
import com.ssafy.s15p11b104.domain.calendar.service.CalendarEventService;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CalendarEventCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * 날짜 표현 해석은 모델이 담당하므로 이 경계의 책임은 모델이 계산한 절대 날짜의
 * 형식·순서·기간 검증뿐이다. 검증에 실패하면 조회를 위임하지 않는 것까지 확인한다.
 */
class AiCallCalendarToolServiceTest {

	private static final Long CALL_SESSION_ID = 7L;
	private static final Long GROUP_ID = 11L;
	private static final Long CARE_RECEIVER_USER_ID = 23L;

	private CallSessionRepository callSessionRepository;
	private CalendarEventService calendarEventService;
	private CalendarEventCallRepository calendarEventCallRepository;
	private AiCallCalendarToolService calendarToolService;

	@BeforeEach
	void setUp() {
		callSessionRepository = mock(CallSessionRepository.class);
		calendarEventService = mock(CalendarEventService.class);
		calendarEventCallRepository = mock(CalendarEventCallRepository.class);
		calendarToolService = new AiCallCalendarToolService(
			callSessionRepository, calendarEventService, calendarEventCallRepository);
		givenCallSessionWithStatus(CallStatus.IN_PROGRESS);
	}

	@ParameterizedTest
	@NullAndEmptySource
	@ValueSource(strings = {"   ", "2026-8-7", "20260807", "2026/08/07", "2026-02-30", "오늘", "+12026-08-07"})
	void rejectsNonIsoDateWithoutQuerying(String invalidDate) {
		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, invalidDate, "2026-08-07");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.NEEDS_CLARIFICATION);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.INVALID_ARGUMENTS);
		verifyNoInteractions(calendarEventService);
	}

	@Test
	void rejectsInvalidEndDateWithoutQuerying() {
		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-07", "내일");

		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.INVALID_ARGUMENTS);
		verifyNoInteractions(calendarEventService);
	}

	@Test
	void rejectsStartDateAfterEndDateWithoutQuerying() {
		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-08", "2026-08-07");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.NEEDS_CLARIFICATION);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.INVALID_ARGUMENTS);
		verifyNoInteractions(calendarEventService);
	}

	@Test
	void rejectsRangeLongerThanSevenDaysWithoutQuerying() {
		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-01", "2026-08-08");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.NEEDS_CLARIFICATION);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.DATE_RANGE_TOO_LONG);
		verifyNoInteractions(calendarEventService);
	}

	/** 7일은 포함 일수 기준이므로 8월 1일부터 7일까지는 허용된다. */
	@Test
	void allowsRangeOfExactlySevenInclusiveDays() {
		givenNoEvents();

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-01", "2026-08-07");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		verify(calendarEventService).getEvents(
			GROUP_ID,
			LocalDate.of(2026, 8, 1),
			LocalDate.of(2026, 8, 7),
			CARE_RECEIVER_USER_ID);
	}

	@ParameterizedTest
	@CsvSource({
		"2026-08-07, 2026-08-07",
		"2026-08-02, 2026-08-04"
	})
	void delegatesRequestedRangeWithSessionGroupAndCareReceiver(String startDate, String endDate) {
		givenNoEvents();

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, startDate, endDate);

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.SUCCESS);
		assertThat(result.startDate()).isEqualTo(startDate);
		assertThat(result.endDate()).isEqualTo(endDate);
		verify(calendarEventService).getEvents(
			GROUP_ID,
			LocalDate.parse(startDate),
			LocalDate.parse(endDate),
			CARE_RECEIVER_USER_ID);
	}

	/** 종료된 통화에는 인자 검증 결과조차 노출하지 않는다. */
	@Test
	void masksArgumentProblemsWhenCallSessionIsTerminal() {
		givenCallSessionWithStatus(CallStatus.COMPLETED);

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "잘못된 날짜", "2026-08-99");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		verifyNoInteractions(calendarEventService);
	}

	@Test
	void reportsCallNotActiveWhenCallSessionIsMissing() {
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.empty());

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-07", "2026-08-07");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		verifyNoInteractions(calendarEventService);
	}

	/** 권한이 사라진 경우 일정 존재 여부를 노출하지 않도록 FORBIDDEN을 마스킹한다. */
	@Test
	void masksForbiddenAsCallNotActive() {
		when(calendarEventService.getEvents(any(), any(), any(), any()))
			.thenThrow(new BusinessException(ErrorCode.FORBIDDEN));

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-07", "2026-08-07");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
	}

	@Test
	void rejectsCareReceiverWhoLeftTheGroup() {
		CallSession callSession = mock(CallSession.class, RETURNS_DEEP_STUBS);
		when(callSession.getStatus()).thenReturn(CallStatus.IN_PROGRESS);
		when(callSession.getCareReceiverMember().getLeftAt()).thenReturn(Instant.parse("2026-08-01T00:00:00Z"));
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));

		AiCallToolResult result = calendarToolService.getEventsByDateRange(
			CALL_SESSION_ID, "2026-08-07", "2026-08-07");

		assertThat(result.status()).isEqualTo(AiCallToolResult.Status.UNAVAILABLE);
		assertThat(result.reason()).isEqualTo(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		verifyNoInteractions(calendarEventService);
	}

	private void givenCallSessionWithStatus(CallStatus status) {
		CallSession callSession = mock(CallSession.class, RETURNS_DEEP_STUBS);
		when(callSession.getStatus()).thenReturn(status);
		when(callSession.getCareReceiverMember().getLeftAt()).thenReturn(null);
		when(callSession.getGroup().getId()).thenReturn(GROUP_ID);
		when(callSession.getCareReceiverMember().getUser().getId()).thenReturn(CARE_RECEIVER_USER_ID);
		when(callSessionRepository.findById(CALL_SESSION_ID)).thenReturn(Optional.of(callSession));
	}

	private void givenNoEvents() {
		when(calendarEventService.getEvents(eq(GROUP_ID), any(), any(), eq(CARE_RECEIVER_USER_ID)))
			.thenReturn(new CalendarEventListResponse(List.of()));
	}
}
