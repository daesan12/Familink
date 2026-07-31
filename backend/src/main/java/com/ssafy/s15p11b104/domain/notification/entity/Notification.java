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
		this(receiver, null, null, type, null, title, body);
	}

	public Notification(
		User receiver,
		NotificationType type,
		ReminderSlot reminderSlot,
		String title,
		String body
	) {
		this(receiver, null, null, type, reminderSlot, title, body);
	}

	public Notification(
		User receiver,
		User actor,
		FamilyGroup group,
		NotificationType type,
		String title,
		String body
	) {
		this(receiver, actor, group, type, null, title, body);
	}

	private Notification(
		User receiver,
		User actor,
		FamilyGroup group,
		NotificationType type,
		ReminderSlot reminderSlot,
		String title,
		String body
	) {
		this.receiver = receiver;
		this.actor = actor;
		this.group = group;
		this.type = type;
		this.reminderSlot = reminderSlot;
		this.title = title;
		this.body = body;
	}

	/**
	 * 일정 시작 알림을 생성한다.
	 *
	 * <p>{@code uq_event_reminder_notification}이 {@code related_event_id}가 있는 행만 중복으로
	 * 판정하므로 일정 연결은 선택이 아니라 필수다. 발화 주체가 스케줄러이므로 {@code actor}는
	 * 비워 둔다.
	 */
	public static Notification eventReminder(
		User receiver,
		CalendarEvent event,
		ReminderSlot reminderSlot,
		String title,
		String body
	) {
		Notification notification =
			new Notification(receiver, NotificationType.EVENT_REMINDER, reminderSlot, title, body);
		notification.relatedEvent = event;
		notification.group = event.getGroup();
		return notification;
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

	public void markRead(Instant readAt) {
		if (this.readAt == null) {
			this.readAt = readAt;
		}
	}
}
