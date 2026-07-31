package com.ssafy.s15p11b104.domain.notification.event;

import java.util.List;
import java.util.UUID;

public sealed interface DomainNotificationEvent {

	record JoinRequestCreated(Long joinRequestId) implements DomainNotificationEvent {
	}

	record JoinRequestDecided(
		Long joinRequestId,
		Long actorUserId,
		Decision decision
	) implements DomainNotificationEvent {
	}

	record PostCreated(Long postId) implements DomainNotificationEvent {
	}

	record CommentCreated(Long commentId) implements DomainNotificationEvent {
	}

	record ReactionCreated(Long reactionId) implements DomainNotificationEvent {
	}

	record CalendarChanged(
		Long eventId,
		Long groupId,
		Long actorMemberId,
		String title,
		List<Long> beforeParticipantMemberIds,
		List<Long> afterParticipantMemberIds,
		CalendarAction action,
		UUID changeId
	) implements DomainNotificationEvent {

		public CalendarChanged {
			beforeParticipantMemberIds = List.copyOf(beforeParticipantMemberIds);
			afterParticipantMemberIds = List.copyOf(afterParticipantMemberIds);
		}
	}

	record CallReportCreated(Long callReportId) implements DomainNotificationEvent {
	}

	record DailyReportCreated(Long dailyReportId) implements DomainNotificationEvent {
	}

	enum Decision {
		APPROVED,
		REJECTED
	}

	enum CalendarAction {
		CREATED,
		UPDATED,
		DELETED
	}
}
