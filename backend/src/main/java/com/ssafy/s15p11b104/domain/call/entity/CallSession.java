package com.ssafy.s15p11b104.domain.call.entity;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
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
@Table(name = "call_sessions")
public class CallSession extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "group_id", nullable = false)
	private FamilyGroup group;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "care_receiver_member_id", nullable = false)
	private GroupMember careReceiverMember;

	@Column(name = "persona_id", nullable = false)
	private Long personaId;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(nullable = false, columnDefinition = "call_status")
	private CallStatus status;

	@Column(name = "started_at")
	private Instant startedAt;

	@Column(name = "ended_at")
	private Instant endedAt;

	protected CallSession() {
	}

	public CallSession(FamilyGroup group, GroupMember careReceiverMember, Long personaId, CallStatus status) {
		this.group = group;
		this.careReceiverMember = careReceiverMember;
		this.personaId = personaId;
		this.status = status;
	}

	public FamilyGroup getGroup() {
		return group;
	}

	public GroupMember getCareReceiverMember() {
		return careReceiverMember;
	}

	public Long getPersonaId() {
		return personaId;
	}

	public CallStatus getStatus() {
		return status;
	}

	public Instant getStartedAt() {
		return startedAt;
	}

	public Instant getEndedAt() {
		return endedAt;
	}

	public void markConnected(Instant connectedAt) {
		requireStatus(CallStatus.CONNECTING);
		status = CallStatus.IN_PROGRESS;
		startedAt = connectedAt;
	}

	public void markConnectionFailed(Instant failedAt) {
		requireStatus(CallStatus.CONNECTING);
		status = CallStatus.FAILED;
		endedAt = failedAt;
	}

	public void endByUser(Instant endedAt) {
		if (status == CallStatus.CONNECTING) {
			status = CallStatus.CANCELLED;
		} else if (status == CallStatus.IN_PROGRESS) {
			status = CallStatus.COMPLETED;
		} else if (status == CallStatus.CANCELLED || status == CallStatus.COMPLETED) {
			return;
		} else {
			throw new IllegalStateException("현재 통화 상태에서는 종료할 수 없습니다.");
		}
		this.endedAt = endedAt;
	}

	public void markUnexpectedDisconnect(Instant disconnectedAt) {
		if (status == CallStatus.CONNECTING) {
			status = CallStatus.FAILED;
		} else if (status == CallStatus.IN_PROGRESS) {
			status = CallStatus.INCOMPLETE;
		} else {
			return;
		}
		endedAt = disconnectedAt;
	}

	private void requireStatus(CallStatus expected) {
		if (status != expected) {
			throw new IllegalStateException("유효하지 않은 통화 상태입니다.");
		}
	}
}
