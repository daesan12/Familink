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
	List<PersonCandidate> candidates
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
			List.copyOf(candidates)
		);
	}

	public static AiCallToolResult unavailable(Reason reason) {
		return new AiCallToolResult(Status.UNAVAILABLE, reason, null, null, null, null, null);
	}

	public static AiCallToolResult error(Reason reason) {
		return new AiCallToolResult(Status.ERROR, reason, null, null, null, null, null);
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
}
