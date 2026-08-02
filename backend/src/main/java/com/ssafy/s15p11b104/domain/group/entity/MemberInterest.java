package com.ssafy.s15p11b104.domain.group.entity;

import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "member_interests")
public class MemberInterest extends CreatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "care_receiver_member_id", nullable = false)
	private GroupMember careReceiverMember;

	@Column(name = "interest_text", nullable = false, length = 10)
	private String interestText;

	protected MemberInterest() {
	}

	public MemberInterest(GroupMember careReceiverMember, String interestText) {
		this.careReceiverMember = careReceiverMember;
		this.interestText = interestText;
	}

	public GroupMember getCareReceiverMember() {
		return careReceiverMember;
	}

	public String getInterestText() {
		return interestText;
	}
}
