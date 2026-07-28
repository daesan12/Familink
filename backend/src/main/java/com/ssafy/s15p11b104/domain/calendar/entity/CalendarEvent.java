package com.ssafy.s15p11b104.domain.calendar.entity;

import java.time.LocalDate;
import java.time.LocalTime;

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

	@Column(name = "event_date", nullable = false)
	private LocalDate eventDate;

	@Column(name = "start_at")
	private LocalTime startAt;

	@Column(name = "end_at")
	private LocalTime endAt;

	protected CalendarEvent() {
	}

	public CalendarEvent(FamilyGroup group, GroupMember creatorMember, String title, LocalDate eventDate) {
		this.group = group;
		this.creatorMember = creatorMember;
		this.lastEditorMember = creatorMember;
		this.title = title;
		this.eventDate = eventDate;
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

	public LocalTime getStartAt() {
		return startAt;
	}

	public LocalTime getEndAt() {
		return endAt;
	}
}
