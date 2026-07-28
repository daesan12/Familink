package com.ssafy.s15p11b104.domain.group.entity;

import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "family_groups")
public class FamilyGroup extends BaseEntity {

	@Column(nullable = false, length = 10)
	private String name;

	@Column(name = "invite_code", nullable = false, unique = true, length = 6)
	private String inviteCode;

	protected FamilyGroup() {
	}

	public FamilyGroup(String name, String inviteCode) {
		this.name = name;
		this.inviteCode = inviteCode;
	}

	public String getName() {
		return name;
	}

	public String getInviteCode() {
		return inviteCode;
	}
}
