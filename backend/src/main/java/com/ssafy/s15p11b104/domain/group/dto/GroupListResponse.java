package com.ssafy.s15p11b104.domain.group.dto;

import java.util.List;

public record GroupListResponse(
	List<GroupSummaryResponse> groups,
	List<JoinRequestSummaryResponse> joinRequests) {
}
