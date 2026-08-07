package com.ssafy.s15p11b104.domain.call.service;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiCallToolResult(
	Status status,
	Reason reason,
	@JsonProperty("person_key")
	String personKey,
	String name,
	@JsonProperty("display_name")
	String displayName,
	List<String> summaries,
	List<PersonCandidate> candidates,
	@JsonProperty("start_date")
	String startDate,
	@JsonProperty("end_date")
	String endDate,
	List<CalendarEventItem> events
) {

	public static AiCallToolResult success(
		String personKey,
		AiCallPersonReference reference,
		List<String> summaries
	) {
		return new AiCallToolResult(
			Status.SUCCESS,
			null,
			personKey,
			reference.name(),
			reference.displayName(),
			List.copyOf(summaries),
			null,
			null,
			null,
			null
		);
	}

	public static AiCallToolResult needsClarification(Reason reason, List<PersonCandidate> candidates) {
		return new AiCallToolResult(
			Status.NEEDS_CLARIFICATION,
			reason,
			null,
			null,
			null,
			null,
			List.copyOf(candidates),
			null,
			null,
			null
		);
	}

	public static AiCallToolResult needsClarification(Reason reason) {
		return new AiCallToolResult(
			Status.NEEDS_CLARIFICATION,
			reason,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null
		);
	}

	public static AiCallToolResult calendarSuccess(
		String startDate,
		String endDate,
		List<CalendarEventItem> events
	) {
		return new AiCallToolResult(
			Status.SUCCESS,
			null,
			null,
			null,
			null,
			null,
			null,
			startDate,
			endDate,
			List.copyOf(events)
		);
	}

	public static AiCallToolResult unavailable(Reason reason) {
		return new AiCallToolResult(Status.UNAVAILABLE, reason, null, null, null, null, null, null, null, null);
	}

	public static AiCallToolResult error(Reason reason) {
		return new AiCallToolResult(Status.ERROR, reason, null, null, null, null, null, null, null, null);
	}

	public enum Status {
		SUCCESS,
		NEEDS_CLARIFICATION,
		UNAVAILABLE,
		ERROR
	}

	public enum Reason {
		UNKNOWN_PERSON_KEY,
		INVALID_ARGUMENTS,
		CALL_NOT_ACTIVE,
		PERSON_NOT_AVAILABLE,
		DATE_RANGE_TOO_LONG,
		UNKNOWN_TOOL,
		TEMPORARY_FAILURE
	}

	public record PersonCandidate(
		@JsonProperty("person_key")
		String personKey,
		String name,
		@JsonProperty("display_name")
		String displayName
	) {
	}

	/**
	 * 모델에 전달하는 일정 항목이다.
	 *
	 * <p>{@code startAt}·{@code endAt}은 `Asia/Seoul` 기준 시각이다. 모델이 음성 안내의
	 * 표시 계층이므로 UTC를 넘기지 않는다. 두 값이 없으면 하루종일 일정이다.
	 * {@code description}과 {@code participants}는 값이 없으면 직렬화에서 제외한다.
	 * 빈 문자열과 빈 목록도 제외해야 프롬프트의 "없으면 그 항목을 말하지 않습니다" 규칙과
	 * 일치하므로 {@code NON_EMPTY}를 쓴다.
	 */
	@JsonInclude(JsonInclude.Include.NON_EMPTY)
	public record CalendarEventItem(
		Long id,
		String title,
		String description,
		@JsonProperty("event_date") String eventDate,
		@JsonProperty("end_date") String endDate,
		@JsonProperty("start_at") String startAt,
		@JsonProperty("end_at") String endAt,
		List<String> participants
	) {
	}
}
