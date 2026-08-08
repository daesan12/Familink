package com.ssafy.s15p11b104.domain.feed.service;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.global.ai.execution.AiTaskExecutor;

/** 주기적으로 안정된 게시글 분석을 시작한다. */
@Component
@ConditionalOnBean(PostAnalysisGateway.class)
@ConditionalOnProperty(prefix = "app.ai-analysis", name = "enabled", havingValue = "true", matchIfMissing = true)
public class PostAnalysisScheduler {
	private static final Logger LOGGER = LoggerFactory.getLogger(PostAnalysisScheduler.class);

	private final PostAnalysisService postAnalysisService;
	private final AiTaskExecutor aiTaskExecutor;

	public PostAnalysisScheduler(PostAnalysisService postAnalysisService, AiTaskExecutor aiTaskExecutor) {
		this.postAnalysisService = postAnalysisService;
		this.aiTaskExecutor = aiTaskExecutor;
	}

	@Scheduled(
		fixedDelayString = "${app.ai-analysis.fixed-delay-ms:3000}",
		initialDelayString = "${app.ai-analysis.initial-delay-ms:3000}")
	public void schedule() {
		if (!aiTaskExecutor.submit(postAnalysisService::analyzeStablePosts)) {
			LOGGER.warn("게시글 분석 작업이 포화된 AI 실행기에서 거부됐습니다.");
		}
	}
}
