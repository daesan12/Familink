package com.ssafy.s15p11b104.domain.group.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "group_members")
public class GroupMember extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "group_role")
	private GroupRole role;

	@Column(name = "is_manager", nullable = false)
	private boolean manager;

	@Column(name = "joined_at", nullable = false)
	private Instant joinedAt;

	@Column(name = "left_at")
	private Instant leftAt;

	protected GroupMember() {
	}

	public GroupMember(FamilyGroup group, User user, GroupRole role, boolean manager, Instant joinedAt) {
		this.group = group;
		this.user = user;
		this.role = role;
		this.manager = manager;
		this.joinedAt = joinedAt;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public User getUser() {
		return user;
	}

	public GroupRole getRole() {
		return role;
	}

	public boolean isManager() {
		return manager;
	}

	public Instant getJoinedAt() {
		return joinedAt;
	}

	public Instant getLeftAt() {
		return leftAt;
	}
}
