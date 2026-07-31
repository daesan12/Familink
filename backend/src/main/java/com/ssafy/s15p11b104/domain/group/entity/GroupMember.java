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

	/**
	 * 그룹에서 나간 시각을 기록해 비활성 구성원으로 만든다.
	 *
	 * <p>행을 삭제하지 않으므로 과거 그룹 관계는 보존된다. 호출 전에 활성 구성원임을 확인한다.
	 *
	 * @param leftAt 나간 시각
	 */
	public void leave(Instant leftAt) {
		this.leftAt = leftAt;
	}

	/**
	 * 탈퇴한 구성원을 다시 활성 상태로 되돌린다.
	 *
	 * <p>중복 행을 만들지 않기 위해 기존 행의 {@code leftAt}을 비우고 역할과 가입 시각을 갱신한다.
	 * 관리자 여부는 항상 해제한다. 이전 관리자였던 사람이 재가입만으로 권한을 되찾으면
	 * {@code uq_group_active_manager}를 위반하거나 현재 관리자의 권한을 조용히 덮어쓴다.
	 *
	 * @param role     재가입 시 지정된 역할
	 * @param joinedAt 재가입 시각
	 */
	public void rejoin(GroupRole role, Instant joinedAt) {
		this.leftAt = null;
		this.role = role;
		this.joinedAt = joinedAt;
		this.manager = false;
	}

	/**
	 * 활성 구성원의 그룹 역할을 바꾼다.
	 *
	 * <p>{@code role}과 {@code is_manager}는 독립된 축이므로 관리자 여부는 함께 바뀌지 않는다.
	 * {@code CARE_RECEIVER}로 바꿀 때 한 사용자가 활성 피보호자로 여러 그룹에 속하지 않는지는
	 * 호출 전에 확인한다.
	 *
	 * @param role 새 역할
	 */
	public void changeRole(GroupRole role) {
		this.role = role;
	}

	/**
	 * 관리자 여부를 설정한다.
	 *
	 * <p>{@code uq_group_active_manager}는 그룹마다 활성 관리자를 한 명으로 제한한다. 위임할
	 * 때는 기존 관리자를 먼저 해제하고 flush한 뒤 새 관리자를 지정해야 한다. 한 트랜잭션에서
	 * 두 변경을 함께 두면 flush 순서에 따라 관리자가 일시적으로 두 명이 되어 인덱스를 위반한다.
	 *
	 * @param manager 관리자로 지정하면 {@code true}
	 */
	public void assignManager(boolean manager) {
		this.manager = manager;
	}

	public boolean isActive() {
		return leftAt == null;
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
