package com.ssafy.s15p11b104.domain.report.repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.report.entity.DailyReportGenerationClaim;

import jakarta.persistence.LockModeType;

public interface DailyReportGenerationClaimRepository
	extends JpaRepository<DailyReportGenerationClaim, Long> {

	Optional<DailyReportGenerationClaim> findByCareReceiverMemberIdAndReportDate(
		Long careReceiverMemberId,
		LocalDate reportDate);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
		select claim
		from DailyReportGenerationClaim claim
		where claim.careReceiverMemberId = :memberId
			and claim.reportDate = :reportDate
		""")
	Optional<DailyReportGenerationClaim> findForUpdate(
		@Param("memberId") Long memberId,
		@Param("reportDate") LocalDate reportDate);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("delete from DailyReportGenerationClaim claim where claim.claimExpiresAt <= :now")
	int deleteExpired(@Param("now") Instant now);
}
