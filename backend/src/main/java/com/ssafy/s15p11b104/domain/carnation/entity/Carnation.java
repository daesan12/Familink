package com.ssafy.s15p11b104.domain.carnation.entity;

import java.time.LocalDate;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "carnations")
public class Carnation extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_member_id", nullable = false)
	private GroupMember groupMember;

	@Column(name = "earned_date", nullable = false)
	private LocalDate earnedDate;

	protected Carnation() {
	}

	public Carnation(FamilyGroup group, GroupMember groupMember, LocalDate earnedDate) {
		this.group = group;
		this.groupMember = groupMember;
		this.earnedDate = earnedDate;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public GroupMember getGroupMember() {
		return groupMember;
	}

	public LocalDate getEarnedDate() {
		return earnedDate;
	}
}
