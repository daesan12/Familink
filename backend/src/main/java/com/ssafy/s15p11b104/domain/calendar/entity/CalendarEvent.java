package com.ssafy.s15p11b104.domain.calendar.entity;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "calendar_events")
public class CalendarEvent extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "creator_member_id", nullable = false)
	private GroupMember creatorMember;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "last_editor_member_id", nullable = false)
	private GroupMember lastEditorMember;

	@Column(nullable = false, length = 20)
	private String title;

	@Column(length = 50)
	private String description;

	/**
	 * 일정의 시작 날짜다. 시간 일정에서는 {@code startAt}의 {@code Asia/Seoul} 날짜와 같다.
	 */
	@Column(name = "event_date", nullable = false)
	private LocalDate eventDate;

	/**
	 * 일정의 종료 날짜다. 하루짜리 일정은 {@code eventDate}와 같고 항상 그보다 빠를 수 없다.
	 */
	@Column(name = "end_date", nullable = false)
	private LocalDate endDate;

	@Column(name = "start_at")
	private Instant startAt;

	@Column(name = "end_at")
	private Instant endAt;

	@Column(name = "reminder_schedule_updated_at", nullable = false)
	private Instant reminderScheduleUpdatedAt;

	@Column(name = "participants_specified", nullable = false)
	private boolean participantsSpecified;

	protected CalendarEvent() {
	}

	/**
	 * 기존 일정 알림 픽스처와의 호환 생성자다. 새 코드에서는 일정 시점 변경을 정확히 기록하기
	 * 위해 {@link #CalendarEvent(FamilyGroup, GroupMember, String, String, LocalDate, LocalDate,
	 * Instant, Instant, Instant)}를 사용한다.
	 */
	public CalendarEvent(
		FamilyGroup group,
		GroupMember creatorMember,
		String title,
		String description,
		LocalDate eventDate,
		LocalDate endDate,
		Instant startAt,
		Instant endAt) {
		this(
			group,
			creatorMember,
			title,
			description,
			eventDate,
			endDate,
			startAt,
			endAt,
			Instant.now());
	}

	/**
	 * 일정을 생성한다. 최종 수정자는 작성자로 초기화한다.
	 *
	 * <p>날짜 쌍은 날짜 일정과 시간 일정 모두 필수다. 시간 일정의 날짜 쌍은 호출자가
	 * {@code startAt}·{@code endAt}에서 파생한 값을 넘겨야 한다.
	 */
	public CalendarEvent(
		FamilyGroup group,
		GroupMember creatorMember,
		String title,
		String description,
		LocalDate eventDate,
		LocalDate endDate,
		Instant startAt,
		Instant endAt,
		Instant reminderScheduleUpdatedAt) {
		this.group = group;
		this.creatorMember = creatorMember;
		this.lastEditorMember = creatorMember;
		this.title = title;
		this.description = description;
		this.eventDate = eventDate;
		this.endDate = endDate;
		this.startAt = startAt;
		this.endAt = endAt;
		this.reminderScheduleUpdatedAt = Objects.requireNonNull(reminderScheduleUpdatedAt);
	}

	/**
	 * 편집 가능한 모든 필드를 한 번에 교체하고 최종 수정자를 기록한다.
	 *
	 * <p>{@code API-CALENDAR-004}가 전체 갱신 계약이므로 필드별 변경 메서드를 두지 않는다.
	 * 날짜 쌍과 시각 쌍의 정합성은 호출자가 보장한다.
	 *
	 * <p>본체 필드가 모두 같고 참여자만 바뀐 요청도 수정으로 취급해야 하므로 항상 수정 시각을 올린다.
	 */
	public void update(
		GroupMember editorMember,
		String title,
		String description,
		LocalDate eventDate,
		LocalDate endDate,
		Instant startAt,
		Instant endAt,
		Instant scheduleUpdatedAt) {
		boolean scheduleChanged = !Objects.equals(this.eventDate, eventDate)
			|| !Objects.equals(this.endDate, endDate)
			|| !Objects.equals(this.startAt, startAt)
			|| !Objects.equals(this.endAt, endAt);
		this.lastEditorMember = editorMember;
		this.title = title;
		this.description = description;
		this.eventDate = eventDate;
		this.endDate = endDate;
		this.startAt = startAt;
		this.endAt = endAt;
		if (scheduleChanged) {
			this.reminderScheduleUpdatedAt = Objects.requireNonNull(scheduleUpdatedAt);
		}
		touch();
	}

	/**
	 * 참여자를 명시적으로 지정한 일정인지 기록한다.
	 *
	 * <p>지정 참여자가 모두 그룹을 떠나 연결 행이 없어져도 이 값은 유지한다. 사용자가 일정 편집에서
	 * 참여자를 모두 해제한 경우에만 호출자가 {@code false}로 바꾼다.
	 */
	public void changeParticipantScope(boolean participantsSpecified) {
		this.participantsSpecified = participantsSpecified;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public GroupMember getCreatorMember() {
		return creatorMember;
	}

	public GroupMember getLastEditorMember() {
		return lastEditorMember;
	}

	public String getTitle() {
		return title;
	}

	public String getDescription() {
		return description;
	}

	public LocalDate getEventDate() {
		return eventDate;
	}

	public LocalDate getEndDate() {
		return endDate;
	}

	public Instant getStartAt() {
		return startAt;
	}

	public Instant getEndAt() {
		return endAt;
	}

	public Instant getReminderScheduleUpdatedAt() {
		return reminderScheduleUpdatedAt;
	}

	public boolean isParticipantsSpecified() {
		return participantsSpecified;
	}
}
