package com.ssafy.s15p11b104.domain.report.service;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.report.repository.DailyReportGenerationClaimRepository;

@Service
public class DailyReportGenerationClaimCleanupService {

	private final DailyReportGenerationClaimRepository claimRepository;

	public DailyReportGenerationClaimCleanupService(DailyReportGenerationClaimRepository claimRepository) {
		this.claimRepository = claimRepository;
	}

	@Transactional
	public int cleanup(Instant now) {
		return claimRepository.deleteExpired(now);
	}
}
