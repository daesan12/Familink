package com.ssafy.s15p11b104.domain.report.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.report.entity.DailyReport;

public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {

	boolean existsByCareReceiverMemberIdAndReportDate(Long careReceiverMemberId, LocalDate reportDate);

	Optional<DailyReport> findByCareReceiverMemberIdAndReportDate(
		Long careReceiverMemberId, LocalDate reportDate);

	/**
	 * 한 피보호자의 일일 리포트가 있는 날짜만 조회한다.
	 *
	 * <p>달력은 리포트 본문이 필요 없으므로 엔티티를 로딩하지 않는 스칼라 프로젝션을 쓴다. 리포트가
	 * 있는 날짜만 반환하므로 보호자가 고른 날짜에는 항상 일일 리포트가 있다.
	 */
	@Query("""
		select report.reportDate
		from DailyReport report
		where report.careReceiverMember.id = :careReceiverMemberId
			and report.reportDate between :startDate and :endDate
		order by report.reportDate
		""")
	List<LocalDate> findReportDatesInRange(
		@Param("careReceiverMemberId") Long careReceiverMemberId,
		@Param("startDate") LocalDate startDate,
		@Param("endDate") LocalDate endDate);

	@Query("""
		select max(report.reportDate)
		from DailyReport report
		where report.careReceiverMember.id = :careReceiverMemberId
		""")
	Optional<LocalDate> findLatestReportDate(
		@Param("careReceiverMemberId") Long careReceiverMemberId);
}
