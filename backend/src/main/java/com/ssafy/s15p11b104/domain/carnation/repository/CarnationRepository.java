package com.ssafy.s15p11b104.domain.carnation.repository;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.carnation.entity.Carnation;

public interface CarnationRepository extends JpaRepository<Carnation, Long> {

	@Query("""
		select carnation.earnedDate
		from Carnation carnation
		where carnation.group.id = :groupId
		  and carnation.groupMember.id = :memberId
		  and carnation.earnedDate between :startDate and :endDate
		order by carnation.earnedDate
		""")
	List<LocalDate> findEarnedDates(
		@Param("groupId") Long groupId,
		@Param("memberId") Long memberId,
		@Param("startDate") LocalDate startDate,
		@Param("endDate") LocalDate endDate);

	@Query("""
		select carnation.groupMember.id as memberId, count(carnation) as carnationCount
		from Carnation carnation
		where carnation.group.id = :groupId
		  and carnation.earnedDate >= :startDate
		  and carnation.earnedDate < :endDateExclusive
		group by carnation.groupMember.id
		""")
	List<CarnationCount> countByMember(
		@Param("groupId") Long groupId,
		@Param("startDate") LocalDate startDate,
		@Param("endDateExclusive") LocalDate endDateExclusive);

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

	interface CarnationCount {

		Long getMemberId();

		long getCarnationCount();
	}
}
