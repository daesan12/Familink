package com.ssafy.s15p11b104.domain.notification.repository;

import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;

@Repository
public class NotificationCreationStore {

	private static final String INSERT_SQL = """
		insert into notifications (
			receiver_user_id,
			actor_user_id,
			group_id,
			related_join_request_id,
			related_post_id,
			related_event_id,
			related_call_report_id,
			related_daily_report_id,
			type,
			reminder_slot,
			title,
			body,
			source_event_key
		)
		values (?, ?, ?, ?, ?, ?, ?, ?, cast(? as notification_type), cast(? as reminder_slot), ?, ?, ?)
		on conflict do nothing
		returning id
		""";

	private final JdbcTemplate jdbcTemplate;

	public NotificationCreationStore(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	public Optional<Long> insert(Command command) {
		String reminderSlot = command.reminderSlot() == null ? null : command.reminderSlot().name();
		return jdbcTemplate.query(
				INSERT_SQL,
				(resultSet, rowNumber) -> resultSet.getLong("id"),
				command.receiverUserId(),
				command.actorUserId(),
				command.groupId(),
				command.relatedJoinRequestId(),
				command.relatedPostId(),
				command.relatedEventId(),
				command.relatedCallReportId(),
				command.relatedDailyReportId(),
				command.type().name(),
				reminderSlot,
				command.title(),
				command.body(),
				command.sourceEventKey())
			.stream()
			.findFirst();
	}

	public record Command(
		Long receiverUserId,
		Long actorUserId,
		Long groupId,
		Long relatedJoinRequestId,
		Long relatedPostId,
		Long relatedEventId,
		Long relatedCallReportId,
		Long relatedDailyReportId,
		NotificationType type,
		ReminderSlot reminderSlot,
		String title,
		String body,
		String sourceEventKey
	) {
	}
}
