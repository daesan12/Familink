package com.ssafy.s15p11b104.domain.feed.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 주기적으로 안정된 게시글 분석을 시작한다. */
@Component
@ConditionalOnBean(PostAnalysisGateway.class)
@ConditionalOnProperty(prefix = "app.ai-analysis", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PostAnalysisScheduler {

	private final PostAnalysisService postAnalysisService;

	public PostAnalysisScheduler(PostAnalysisService postAnalysisService) {
		this.postAnalysisService = postAnalysisService;
	}

	@Scheduled(
		fixedDelayString = "${app.ai-analysis.fixed-delay-ms:60000}",
		initialDelayString = "${app.ai-analysis.initial-delay-ms:60000}")
	public void schedule() {
		postAnalysisService.analyzeStablePosts();
	}
}
