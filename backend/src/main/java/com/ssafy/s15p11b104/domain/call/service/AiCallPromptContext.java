package com.ssafy.s15p11b104.domain.call.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record AiCallPromptContext(
	CareReceiverContext careReceiver,
	List<FamilyMemberContext> familyMembers,
	List<TodayPostContext> todayPosts,
	List<RecentCallContext> recentCalls
) {

	public record CareReceiverContext(
		String name,
		List<String> interests,
		LocalDate currentDateKst
	) {
	}

	public record FamilyMemberContext(
		String personKey,
		String name,
		String displayName
	) {
	}

	public record TodayPostContext(
		String authorDisplayName,
		String summary,
		OffsetDateTime createdAtKst
	) {
	}

	public record RecentCallContext(
		String summary,
		LocalDate endedDateKst
	) {
	}
}
