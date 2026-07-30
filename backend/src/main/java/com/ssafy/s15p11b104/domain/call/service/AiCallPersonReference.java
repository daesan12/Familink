package com.ssafy.s15p11b104.domain.call.service;

public record AiCallPersonReference(
	Long groupMemberId,
	String name,
	String displayName
) {
}
