package com.ssafy.s15p11b104.domain.report.repository;

import java.time.LocalDate;

import org.springframework.data.jpa.repository.JpaRepository;

import com.ssafy.s15p11b104.domain.report.entity.DailyReport;

public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {

	boolean existsByCareReceiverMemberIdAndReportDate(Long careReceiverMemberId, LocalDate reportDate);
}
