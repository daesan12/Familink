package com.ssafy.s15p11b104.domain.call.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.group.entity.MemberInterest;

public interface MemberInterestCallRepository extends JpaRepository<MemberInterest, Long> {

	List<MemberInterest> findAllByCareReceiverMemberIdOrderByCreatedAtAsc(Long careReceiverMemberId);
}
