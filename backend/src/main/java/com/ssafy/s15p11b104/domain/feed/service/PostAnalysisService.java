package com.ssafy.s15p11b104.domain.feed.service;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;

import jakarta.persistence.EntityManager;

/** 게시글 안정성 확인, AI 분석 호출, 분석 결과 저장을 담당한다. */
@Service
public class PostAnalysisService {

	static final int SUMMARY_MAX_CODE_POINTS = 500;
	private static final long STABILITY_MINUTES = 10;

	private final PostRepository postRepository;
	private final PostAnalysisRepository postAnalysisRepository;
	private final ObjectProvider<PostAnalysisGateway> gatewayProvider;
	private final ObjectProvider<EntityManager> entityManagerProvider;
	private final ReentrantLock processingLock = new ReentrantLock();

	public PostAnalysisService(
		PostRepository postRepository,
		PostAnalysisRepository postAnalysisRepository,
		ObjectProvider<PostAnalysisGateway> gatewayProvider,
		ObjectProvider<EntityManager> entityManagerProvider) {
		this.postRepository = postRepository;
		this.postAnalysisRepository = postAnalysisRepository;
		this.gatewayProvider = gatewayProvider;
		this.entityManagerProvider = entityManagerProvider;
	}

	/**
	 * 마지막 수정 후 10분이 지난 게시글을 한 번씩 분석한다.
	 * 같은 애플리케이션 인스턴스에서 스케줄러가 겹쳐 실행되는 것을 막는다.
	 */
	@Transactional
	public void analyzeStablePosts() {
		PostAnalysisGateway gateway = gatewayProvider.getIfAvailable();
		if (gateway == null || !processingLock.tryLock()) {
			return;
		}

		try {
			Instant cutoff = Instant.now().minusSeconds(STABILITY_MINUTES * 60);
			List<Long> postIds = postAnalysisRepository.findStablePostIds(cutoff, AnalysisStatus.SUCCESS);
			for (Long postId : postIds) {
				analyzePost(postId, cutoff, gateway);
			}
		} finally {
			processingLock.unlock();
		}
	}

	private void analyzePost(Long postId, Instant cutoff, PostAnalysisGateway gateway) {
		Post post = postRepository.findById(postId).orElse(null);
		if (post == null || post.getUpdatedAt() == null || post.getUpdatedAt().isAfter(cutoff)) {
			return;
		}

		PostAnalysis analysis = postAnalysisRepository.findByPostId(postId)
			.orElseGet(() -> postAnalysisRepository.save(new PostAnalysis(post,
				AnalysisStatus.PENDING)));
		analysis.resetToPending();
		postAnalysisRepository.flush();
		Instant analyzedPostVersion = post.getUpdatedAt();

		try {
			String summary = normalizeSummary(gateway.analyze(postId));
			EntityManager entityManager = entityManagerProvider.getIfAvailable();
			if (entityManager != null) {
				entityManager.refresh(post);
			}
			if (!analyzedPostVersion.equals(post.getUpdatedAt())) {
				resetToPending(postId);
				return;
			}
			Instant analyzedAt = Instant.now();
			int updatedRows = postAnalysisRepository.completeIfPostUnchanged(
				analysis.getId(), analyzedPostVersion, summary, analyzedAt);
			if (updatedRows == 0) {
				resetToPending(postId);
				return;
			}
			analysis.complete(summary, analyzedAt);
		} catch (Exception exception) {
			analysis.fail();
		}
	}

	private void resetToPending(Long postId) {
		postAnalysisRepository.findByPostId(postId).ifPresent(PostAnalysis::resetToPending);
	}

	private String normalizeSummary(String summary) {
		if (summary == null) {
			throw new IllegalArgumentException("AI summary must not be null");
		}
		String normalized = summary.trim();
		if (normalized.isEmpty() || normalized.codePointCount(0, normalized.length()) > SUMMARY_MAX_CODE_POINTS) {
			throw new IllegalArgumentException("AI summary must be between 1 and 500 code points");
		}
		return normalized;
	}
}
