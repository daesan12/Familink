package com.ssafy.s15p11b104.domain.carnation.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.carnation.entity.Carnation;

public interface CarnationRepository extends JpaRepository<Carnation, Long> {

	@Modifying(flushAutomatically = true)
	@Query(value = """
		insert into carnations (group_id, group_member_id, earned_date)
		values (:groupId, :groupMemberId, :earnedDate)
		on conflict (group_member_id, earned_date) do nothing
		""", nativeQuery = true)
	int insertIfAbsent(
		@Param("groupId") Long groupId,
		@Param("groupMemberId") Long groupMemberId,
		@Param("earnedDate") LocalDate earnedDate);
}
