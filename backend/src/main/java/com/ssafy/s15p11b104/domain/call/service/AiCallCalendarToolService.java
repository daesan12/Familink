package com.ssafy.s15p11b104.domain.call.service;

import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListItem;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListResponse;
import com.ssafy.s15p11b104.domain.calendar.service.CalendarEventService;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * AI 통화에서 현재 그룹의 하루 일정만 조회하는 Tool 구현이다.
 *
 * <p>날짜 표현은 이 경계에서 해석하며, 해석할 수 없는 표현은 임의의 날짜로
 * 바꾸지 않고 명확화 결과를 반환한다. 실제 일정 조회와 현재 그룹 구성원 권한은
 * 일반 {@link CalendarEventService}에 위임한다.
 */
@Service
public class AiCallCalendarToolService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
	private static final Set<CallStatus> ACTIVE_STATUSES = Set.of(
		CallStatus.CONNECTING,
		CallStatus.IN_PROGRESS
	);
	private static final Pattern ISO_DATE = Pattern.compile("^(\\d{4})[-/.](\\d{1,2})[-/.](\\d{1,2})$");
	private static final Pattern KOREAN_DATE = Pattern.compile("^(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일$");
	private static final Pattern WEEKDAY = Pattern.compile("^(이번|다음|지난)\\s*주?\\s*(월|화|수|목|금|토|일)(?:요일)?$");

	private final CallSessionRepository callSessionRepository;
	private final CalendarEventService calendarEventService;
	private final Clock clock;

	public AiCallCalendarToolService(
		CallSessionRepository callSessionRepository,
		CalendarEventService calendarEventService,
		Clock clock
	) {
		this.callSessionRepository = callSessionRepository;
		this.calendarEventService = calendarEventService;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public AiCallToolResult getEventsByDate(Long callSessionId, String dateExpression) {
		CallSession callSession = callSessionRepository.findById(callSessionId).orElse(null);
		if (callSession == null
			|| !ACTIVE_STATUSES.contains(callSession.getStatus())
			|| callSession.getCareReceiverMember().getLeftAt() != null) {
			return AiCallToolResult.unavailable(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		}

		LocalDate date = resolveDate(dateExpression, LocalDate.now(clock.withZone(BUSINESS_ZONE)));
		if (date == null) {
			return AiCallToolResult.needsClarification(AiCallToolResult.Reason.AMBIGUOUS_DATE);
		}

		Long groupId = callSession.getGroup().getId();
		Long authenticatedUserId = callSession.getCareReceiverMember().getUser().getId();
		try {
			CalendarEventListResponse response = calendarEventService.getEvents(
				groupId,
				date,
				date,
				authenticatedUserId);
			return AiCallToolResult.calendarSuccess(
				date.toString(),
				response.events().stream().map(this::toToolEvent).toList());
		} catch (BusinessException exception) {
			if (exception.getErrorCode() != ErrorCode.FORBIDDEN) {
				throw exception;
			}
			// 세션의 현재 그룹·피보호자 권한이 더 이상 유효하지 않으면 데이터 존재 여부를 노출하지 않는다.
			return AiCallToolResult.unavailable(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		}
	}

	private AiCallToolResult.CalendarEventItem toToolEvent(CalendarEventListItem event) {
		return new AiCallToolResult.CalendarEventItem(
			event.id(),
			event.title(),
			event.eventDate().toString(),
			event.endDate().toString(),
			event.startAt() == null ? null : event.startAt().toString(),
			event.endAt() == null ? null : event.endAt().toString());
	}

	static LocalDate resolveDate(String dateExpression, LocalDate today) {
		if (!StringUtils.hasText(dateExpression)) {
			return null;
		}
		String expression = dateExpression.trim().toLowerCase(Locale.ROOT);
		return switch (expression) {
			case "오늘", "금일", "today" -> today;
			case "내일", "tomorrow" -> today.plusDays(1);
			case "어제", "yesterday" -> today.minusDays(1);
			default -> resolveExplicitDate(expression, today);
		};
	}

	private static LocalDate resolveExplicitDate(String expression, LocalDate today) {
		Matcher dateMatcher = ISO_DATE.matcher(expression);
		if (!dateMatcher.matches()) {
			dateMatcher = KOREAN_DATE.matcher(expression);
		}
		if (dateMatcher.matches()) {
			try {
				return LocalDate.of(
					Integer.parseInt(dateMatcher.group(1)),
					Integer.parseInt(dateMatcher.group(2)),
					Integer.parseInt(dateMatcher.group(3)));
			} catch (RuntimeException ignored) {
				return null;
			}
		}

		Matcher weekdayMatcher = WEEKDAY.matcher(expression);
		if (!weekdayMatcher.matches()) {
			return null;
		}
		DayOfWeek dayOfWeek = toDayOfWeek(weekdayMatcher.group(2));
		LocalDate weekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
		int weekOffset = switch (weekdayMatcher.group(1)) {
			case "다음" -> 1;
			case "지난" -> -1;
			default -> 0;
		};
		return weekStart.plusWeeks(weekOffset).with(TemporalAdjusters.nextOrSame(dayOfWeek));
	}

	private static DayOfWeek toDayOfWeek(String koreanDay) {
		return switch (koreanDay) {
			case "월" -> DayOfWeek.MONDAY;
			case "화" -> DayOfWeek.TUESDAY;
			case "수" -> DayOfWeek.WEDNESDAY;
			case "목" -> DayOfWeek.THURSDAY;
			case "금" -> DayOfWeek.FRIDAY;
			case "토" -> DayOfWeek.SATURDAY;
			case "일" -> DayOfWeek.SUNDAY;
			default -> throw new IllegalArgumentException("지원하지 않는 요일입니다.");
		};
	}
}
