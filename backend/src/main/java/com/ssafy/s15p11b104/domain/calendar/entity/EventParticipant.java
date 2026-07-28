package com.ssafy.s15p11b104.domain.calendar.entity;

import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.entity.IdentityEntity;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "event_participants")
public class EventParticipant extends IdentityEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "event_id", nullable = false)
	private CalendarEvent event;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_member_id", nullable = false)
	private GroupMember groupMember;

	protected EventParticipant() {
	}

	public EventParticipant(CalendarEvent event, GroupMember groupMember) {
		this.event = event;
		this.groupMember = groupMember;
	}

	public CalendarEvent getEvent() {
		return event;
	}

	public GroupMember getGroupMember() {
		return groupMember;
	}
}
