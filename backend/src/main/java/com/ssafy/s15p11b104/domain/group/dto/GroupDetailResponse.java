package com.ssafy.s15p11b104.domain.group.dto;

public record GroupDetailResponse(
	Long id,
	String name,
	Long managerMemberId,
	boolean isManager,
	long guardianCount,
	long careReceiverCount,
	long memberCount) {
}
