package com.ssafy.s15p11b104.domain.group.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.account.entity.User;
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
@Table(name = "group_join_requests")
public class GroupJoinRequest extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "applicant_user_id", nullable = false)
	private User applicant;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "assigned_role", columnDefinition = "group_role")
	private GroupRole assignedRole;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "join_request_status")
	private JoinRequestStatus status;

	@Column(name = "processed_at")
	private Instant processedAt;

	protected GroupJoinRequest() {
	}

	public GroupJoinRequest(FamilyGroup group, User applicant, JoinRequestStatus status) {
		this.group = group;
		this.applicant = applicant;
		this.status = status;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public User getApplicant() {
		return applicant;
	}

	public GroupRole getAssignedRole() {
		return assignedRole;
	}

	public JoinRequestStatus getStatus() {
		return status;
	}

	public Instant getProcessedAt() {
		return processedAt;
	}
}
