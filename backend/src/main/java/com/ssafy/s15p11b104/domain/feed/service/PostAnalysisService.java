package com.ssafy.s15p11b104.domain.feed.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;

/** 게시글 안정성 확인, AI 분석 호출, 분석 결과 저장을 담당한다. */
@Service
public class PostAnalysisService {

	static final int SUMMARY_MAX_CODE_POINTS = 500;
	static final int MAX_ATTEMPTS = 3;
	static final int BATCH_SIZE = 20;
	static final Duration CLAIM_LEASE = Duration.ofSeconds(90);
	private static final Duration STABILITY_DELAY = Duration.ofMinutes(10);
	private static final Duration INITIAL_RETRY_DELAY = Duration.ofMinutes(1);
	private static final Duration MAX_RETRY_DELAY = Duration.ofMinutes(15);

	private final PostRepository postRepository;
	private final PostAnalysisRepository postAnalysisRepository;
	private final ObjectProvider<PostAnalysisGateway> gatewayProvider;
	private final TransactionTemplate transactionTemplate;
	private final Clock clock;
	private final ReentrantLock processingLock = new ReentrantLock();

	public PostAnalysisService(
		PostRepository postRepository,
		PostAnalysisRepository postAnalysisRepository,
		ObjectProvider<PostAnalysisGateway> gatewayProvider,
		TransactionTemplate transactionTemplate,
		Clock clock
	) {
		this.postRepository = postRepository;
		this.postAnalysisRepository = postAnalysisRepository;
		this.gatewayProvider = gatewayProvider;
		this.transactionTemplate = transactionTemplate;
		this.clock = clock;
	}

	/** 마지막 수정 후 10분이 지난 게시글을 한 번에 최대 20건 분석한다. */
	public void analyzeStablePosts() {
		PostAnalysisGateway gateway = gatewayProvider.getIfAvailable();
		if (gateway == null || !processingLock.tryLock()) {
			return;
		}

		try {
			Instant now = clock.instant();
			Instant cutoff = now.minus(STABILITY_DELAY);
			List<Long> postIds = postAnalysisRepository.findCandidatePostIds(
				cutoff, now, MAX_ATTEMPTS, PageRequest.of(0, BATCH_SIZE));
			for (Long postId : postIds) {
				analyzePost(postId, cutoff, gateway);
			}
		} finally {
			processingLock.unlock();
		}
	}

	private void analyzePost(Long postId, Instant cutoff, PostAnalysisGateway gateway) {
		ClaimedPost claimedPost = claim(postId, cutoff);
		if (claimedPost == null) {
			return;
		}

		try {
			String summary = normalizeSummary(gateway.analyze(postId));
			complete(claimedPost, summary);
		} catch (RuntimeException exception) {
			if (exception instanceof PostAnalysisFailure failure) {
				fail(claimedPost, failure.getFailureCode(), failure.isRetryable());
			} else {
				fail(claimedPost, "UNEXPECTED_FAILURE", false);
			}
		}
	}

	private ClaimedPost claim(Long postId, Instant cutoff) {
		return transactionTemplate.execute(status -> {
			Post post = postRepository.findByIdForUpdate(postId).orElse(null);
			if (post == null || post.getUpdatedAt() == null || post.getUpdatedAt().isAfter(cutoff)) {
				return null;
			}

			PostAnalysis analysis = postAnalysisRepository.findByPostIdForUpdate(postId)
				.orElseGet(() -> postAnalysisRepository.save(new PostAnalysis(post, AnalysisStatus.PENDING)));
			Instant now = clock.instant();
			if (analysis.hasExpiredExhaustedClaim(now, MAX_ATTEMPTS)) {
				analysis.fail("CLAIM_EXPIRED", now, null);
				return null;
			}
			if (!analysis.isEligible(now, MAX_ATTEMPTS)) {
				return null;
			}

			UUID token = UUID.randomUUID();
			Instant inputUpdatedAt = post.getUpdatedAt();
			analysis.claim(inputUpdatedAt, token, now.plus(CLAIM_LEASE));
			return new ClaimedPost(postId, inputUpdatedAt, token);
		});
	}

	private void complete(ClaimedPost claimedPost, String summary) {
		transactionTemplate.executeWithoutResult(status -> {
			Post post = postRepository.findByIdForUpdate(claimedPost.postId()).orElse(null);
			PostAnalysis analysis = postAnalysisRepository.findByPostIdForUpdate(claimedPost.postId()).orElse(null);
			Instant now = clock.instant();
			if (post == null || analysis == null
				|| !analysis.ownsClaim(claimedPost.token(), claimedPost.inputUpdatedAt(), now)) {
				return;
			}
			if (!claimedPost.inputUpdatedAt().equals(post.getUpdatedAt())) {
				analysis.resetToPending();
				return;
			}
			analysis.complete(summary, now);
		});
	}

	private void fail(ClaimedPost claimedPost, String failureCode, boolean retryable) {
		transactionTemplate.executeWithoutResult(status -> {
			Post post = postRepository.findByIdForUpdate(claimedPost.postId()).orElse(null);
			PostAnalysis analysis = postAnalysisRepository.findByPostIdForUpdate(claimedPost.postId()).orElse(null);
			Instant now = clock.instant();
			if (post == null || analysis == null
				|| !analysis.ownsClaim(claimedPost.token(), claimedPost.inputUpdatedAt(), now)) {
				return;
			}
			if (!claimedPost.inputUpdatedAt().equals(post.getUpdatedAt())) {
				analysis.resetToPending();
				return;
			}
			Instant nextAttemptAt = retryable && analysis.getAttemptCount() < MAX_ATTEMPTS
				? now.plus(retryDelay(analysis.getAttemptCount()))
				: null;
			analysis.fail(failureCode, now, nextAttemptAt);
		});
	}

	private Duration retryDelay(int completedAttempts) {
		long multiplier = 1L << Math.max(0, completedAttempts - 1);
		Duration delay = INITIAL_RETRY_DELAY.multipliedBy(multiplier);
		return delay.compareTo(MAX_RETRY_DELAY) > 0 ? MAX_RETRY_DELAY : delay;
	}

	private String normalizeSummary(String summary) {
		if (summary == null) {
			throw new PostAnalysisFailureException("AI summary must not be null", "INVALID_RESPONSE", false);
		}
		String normalized = summary.trim();
		if (normalized.isEmpty() || normalized.codePointCount(0, normalized.length()) > SUMMARY_MAX_CODE_POINTS) {
			throw new PostAnalysisFailureException(
				"AI summary must be between 1 and 500 code points", "INVALID_RESPONSE", false);
		}
		return normalized;
	}

	private record ClaimedPost(Long postId, Instant inputUpdatedAt, UUID token) {
	}
}
