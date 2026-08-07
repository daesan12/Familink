package com.ssafy.s15p11b104.domain.call.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListItem;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListResponse;
import com.ssafy.s15p11b104.domain.calendar.service.CalendarEventService;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CalendarEventCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * AI 통화에서 현재 그룹의 기간 일정을 조회하는 Tool 구현이다.
 *
 * <p>날짜 표현은 모델이 프롬프트의 `Asia/Seoul` 기준 오늘 날짜로 직접 계산하며,
 * 이 경계는 계산된 절대 날짜의 형식과 기간만 검증한다. 검증에 실패하면 임의의
 * 기간으로 바꾸지 않고 명확화 결과를 반환한다. 실제 일정 조회와 현재 그룹 구성원
 * 권한은 일반 {@link CalendarEventService}에 위임한다.
 */
@Service
public class AiCallCalendarToolService {

	static final int MAX_RANGE_DAYS = 7;

	/** 모델은 음성 안내의 표시 계층이므로 시각을 UTC가 아닌 이 시간대로 넘긴다. */
	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
	private static final int ISO_DATE_LENGTH = "yyyy-MM-dd".length();
	private static final Set<CallStatus> ACTIVE_STATUSES = Set.of(
		CallStatus.CONNECTING,
		CallStatus.IN_PROGRESS
	);

	private final CallSessionRepository callSessionRepository;
	private final CalendarEventService calendarEventService;
	private final CalendarEventCallRepository calendarEventCallRepository;

	public AiCallCalendarToolService(
		CallSessionRepository callSessionRepository,
		CalendarEventService calendarEventService,
		CalendarEventCallRepository calendarEventCallRepository
	) {
		this.callSessionRepository = callSessionRepository;
		this.calendarEventService = calendarEventService;
		this.calendarEventCallRepository = calendarEventCallRepository;
	}

	@Transactional(readOnly = true)
	public AiCallToolResult getEventsByDateRange(Long callSessionId, String startDate, String endDate) {
		CallSession callSession = callSessionRepository.findById(callSessionId).orElse(null);
		if (callSession == null
			|| !ACTIVE_STATUSES.contains(callSession.getStatus())
			|| callSession.getCareReceiverMember().getLeftAt() != null) {
			return AiCallToolResult.unavailable(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		}

		LocalDate start = parseIsoDate(startDate);
		LocalDate end = parseIsoDate(endDate);
		if (start == null || end == null || start.isAfter(end)) {
			return AiCallToolResult.needsClarification(AiCallToolResult.Reason.INVALID_ARGUMENTS);
		}
		long inclusiveDays = ChronoUnit.DAYS.between(start, end) + 1;
		if (inclusiveDays > MAX_RANGE_DAYS) {
			return AiCallToolResult.needsClarification(AiCallToolResult.Reason.DATE_RANGE_TOO_LONG);
		}

		Long groupId = callSession.getGroup().getId();
		Long authenticatedUserId = callSession.getCareReceiverMember().getUser().getId();
		try {
			CalendarEventListResponse response = calendarEventService.getEvents(
				groupId,
				start,
				end,
				authenticatedUserId);
			return AiCallToolResult.calendarSuccess(
				start.toString(),
				end.toString(),
				toToolEvents(response.events()));
		} catch (BusinessException exception) {
			if (exception.getErrorCode() != ErrorCode.FORBIDDEN) {
				throw exception;
			}
			// 세션의 현재 그룹·피보호자 권한이 더 이상 유효하지 않으면 데이터 존재 여부를 노출하지 않는다.
			return AiCallToolResult.unavailable(AiCallToolResult.Reason.CALL_NOT_ACTIVE);
		}
	}

	/**
	 * 일반 목록 응답에 없는 설명과 참여자를 보충해 모델용 항목으로 바꾼다.
	 *
	 * <p>보충 조회는 일정 수와 무관하게 두 번만 수행한다.
	 */
	private List<AiCallToolResult.CalendarEventItem> toToolEvents(List<CalendarEventListItem> events) {
		if (events.isEmpty()) {
			return List.of();
		}

		List<Long> eventIds = events.stream().map(CalendarEventListItem::id).toList();
		Map<Long, String> descriptions = loadDescriptions(eventIds);
		Map<Long, List<String>> participants = loadParticipantNames(eventIds);

		return events.stream()
			.map(event -> new AiCallToolResult.CalendarEventItem(
				event.id(),
				event.title(),
				descriptions.get(event.id()),
				event.eventDate().toString(),
				event.endDate().toString(),
				toBusinessZoneTime(event.startAt()),
				toBusinessZoneTime(event.endAt()),
				participants.getOrDefault(event.id(), List.of())))
			.toList();
	}

	private Map<Long, String> loadDescriptions(List<Long> eventIds) {
		Map<Long, String> descriptions = new HashMap<>();
		for (Object[] row : calendarEventCallRepository.findDescriptionsByEventIds(eventIds)) {
			descriptions.put((Long)row[0], (String)row[1]);
		}
		return descriptions;
	}

	private Map<Long, List<String>> loadParticipantNames(List<Long> eventIds) {
		Map<Long, List<String>> participants = new LinkedHashMap<>();
		for (Object[] row : calendarEventCallRepository.findParticipantNamesByEventIds(eventIds)) {
			participants.computeIfAbsent((Long)row[0], key -> new ArrayList<>()).add((String)row[1]);
		}
		return participants;
	}

	/** 날짜 일정은 시각이 없으므로 {@code null}을 유지해 직렬화에서 제외한다. */
	private String toBusinessZoneTime(Instant instant) {
		if (instant == null) {
			return null;
		}
		return instant.atZone(BUSINESS_ZONE).toOffsetDateTime().toString();
	}

	/**
	 * `yyyy-MM-dd` 절대 날짜만 허용한다. 길이를 먼저 확인하는 이유는
	 * {@link LocalDate#parse}가 `+12026-01-01` 같은 확장 연도 표기도 받아들이기 때문이다.
	 */
	static LocalDate parseIsoDate(String value) {
		if (!StringUtils.hasText(value) || value.length() != ISO_DATE_LENGTH) {
			return null;
		}
		try {
			return LocalDate.parse(value);
		} catch (DateTimeParseException ignored) {
			return null;
		}
	}
}
