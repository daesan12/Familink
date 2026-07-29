package com.ssafy.s15p11b104.domain.group.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;

public interface FamilyGroupRepository extends JpaRepository<FamilyGroup, Long> {

	boolean existsByInviteCode(String inviteCode);
}
