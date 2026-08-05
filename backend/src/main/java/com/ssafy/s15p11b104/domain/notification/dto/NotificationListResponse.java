package com.ssafy.s15p11b104.domain.notification.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;

public record NotificationListResponse(List<Item> content, boolean hasNext) {

	public record Item(
		Long id,
		NotificationType type,
		String title,
		String body,
		Long groupId,
		Actor actor,
		Long relatedJoinRequestId,
		JoinRequestStatus relatedJoinRequestStatus,
		Long relatedPostId,
		Long relatedEventId,
		Long relatedCallReportId,
		Long relatedDailyReportId,
		Long relatedCallSessionId,
		Long relatedCareReceiverMemberId,
		LocalDate relatedReportDate,
		Instant readAt,
		Instant createdAt
	) {
	}

	public record Actor(Long userId, String name, String profileImageUrl) {
	}
}
