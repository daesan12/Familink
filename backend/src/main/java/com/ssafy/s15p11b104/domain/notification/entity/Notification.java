package com.ssafy.s15p11b104.domain.notification.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "notifications")
public class Notification extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "receiver_user_id", nullable = false)
	private User receiver;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "actor_user_id")
	private User actor;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "group_id")
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "related_join_request_id")
	private GroupJoinRequest relatedJoinRequest;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "related_post_id")
	private Post relatedPost;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "related_event_id")
	private CalendarEvent relatedEvent;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "related_call_report_id")
	private CallReport relatedCallReport;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "related_daily_report_id")
	private DailyReport relatedDailyReport;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "notification_type")
	private NotificationType type;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "reminder_slot", columnDefinition = "reminder_slot")
	private ReminderSlot reminderSlot;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String title;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String body;

	@Column(name = "read_at")
	private Instant readAt;

	protected Notification() {
	}

	public Notification(User receiver, NotificationType type, String title, String body) {
		this(receiver, type, null, title, body);
	}

	public Notification(
		User receiver,
		NotificationType type,
		ReminderSlot reminderSlot,
		String title,
		String body
	) {
		this.receiver = receiver;
		this.type = type;
		this.reminderSlot = reminderSlot;
		this.title = title;
		this.body = body;
	}

	public User getReceiver() {
		return receiver;
	}

	public User getActor() {
		return actor;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public GroupJoinRequest getRelatedJoinRequest() {
		return relatedJoinRequest;
	}

	public Post getRelatedPost() {
		return relatedPost;
	}

	public CalendarEvent getRelatedEvent() {
		return relatedEvent;
	}

	public CallReport getRelatedCallReport() {
		return relatedCallReport;
	}

	public DailyReport getRelatedDailyReport() {
		return relatedDailyReport;
	}

	public NotificationType getType() {
		return type;
	}

	public ReminderSlot getReminderSlot() {
		return reminderSlot;
	}

	public String getTitle() {
		return title;
	}

	public String getBody() {
		return body;
	}

	public Instant getReadAt() {
		return readAt;
	}
}
