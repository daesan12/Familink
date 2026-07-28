package com.ssafy.s15p11b104.domain.group.entity;

import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "member_aliases")
public class MemberAlias extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "owner_member_id", nullable = false)
	private GroupMember ownerMember;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "target_member_id", nullable = false)
	private GroupMember targetMember;

	@Column(nullable = false, length = 10)
	private String alias;

	protected MemberAlias() {
	}

	public MemberAlias(FamilyGroup group, GroupMember ownerMember, GroupMember targetMember, String alias) {
		this.group = group;
		this.ownerMember = ownerMember;
		this.targetMember = targetMember;
		this.alias = alias;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public GroupMember getOwnerMember() {
		return ownerMember;
	}

	public GroupMember getTargetMember() {
		return targetMember;
	}

	public String getAlias() {
		return alias;
	}
}
