package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisFailureException;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisGateway;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisService;

@ExtendWith(MockitoExtension.class)
class PostAnalysisServiceTest {

	private static final Instant NOW = Instant.parse("2026-08-02T06:00:00Z");
	private static final Instant STABLE_UPDATED_AT = NOW;

	@Mock
	private PostRepository postRepository;

	@Mock
	private PostAnalysisRepository postAnalysisRepository;

	@Mock
	private ObjectProvider<PostAnalysisGateway> gatewayProvider;

	@Mock
	private TransactionTemplate transactionTemplate;

	@Mock
	private PostAnalysisGateway gateway;

	@Mock
	private Post post;

	private PostAnalysis analysis;
	private PostAnalysisService service;
	private final AtomicBoolean inTransaction = new AtomicBoolean();

	@BeforeEach
	void setUp() {
		analysis = new PostAnalysis(post, AnalysisStatus.PENDING);
		service = new PostAnalysisService(
			postRepository,
			postAnalysisRepository,
			gatewayProvider,
			transactionTemplate,
			Clock.fixed(NOW, ZoneOffset.UTC));
		when(gatewayProvider.getIfAvailable()).thenReturn(gateway);
		when(postAnalysisRepository.findCandidatePostIds(any(), any(), eq(3), any()))
			.thenReturn(List.of(1L));
		when(postRepository.findByIdForUpdate(1L)).thenReturn(Optional.of(post));
		when(postAnalysisRepository.findByPostIdForUpdate(1L)).thenReturn(Optional.of(analysis));
		lenient().when(post.getUpdatedAt()).thenReturn(STABLE_UPDATED_AT);
		lenient().when(transactionTemplate.execute(any())).thenAnswer(invocation -> {
			inTransaction.set(true);
			try {
				return invocation.<TransactionCallback<?>>getArgument(0).doInTransaction(null);
			} finally {
				inTransaction.set(false);
			}
		});
		lenient().doAnswer(invocation -> {
			inTransaction.set(true);
			try {
				invocation.<java.util.function.Consumer<TransactionStatus>>getArgument(0).accept(null);
				return null;
			} finally {
				inTransaction.set(false);
			}
		}).when(transactionTemplate).executeWithoutResult(any());
	}

	@Test
	void stablePostStoresTrimmedSummaryAsSuccess() {
		when(gateway.analyze(1L)).thenAnswer(invocation -> {
			assertThat(inTransaction).isFalse();
			return "  가족과 산책한 이야기  ";
		});

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.SUCCESS);
		assertThat(analysis.getSummary()).isEqualTo("가족과 산책한 이야기");
		assertThat(analysis.getAttemptCount()).isOne();
		assertThat(analysis.getClaimToken()).isNull();
		verify(postAnalysisRepository).findCandidatePostIds(eq(NOW), eq(NOW), eq(3), any());
		verify(gateway).analyze(1L);
	}

	@Test
	void retryableFailureSchedulesOneMinuteBackoff() {
		when(gateway.analyze(1L)).thenThrow(
			new PostAnalysisFailureException("upstream", "HTTP_429", true));

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
		assertThat(analysis.getLastFailureCode()).isEqualTo("HTTP_429");
		assertThat(analysis.getNextAttemptAt()).isEqualTo(NOW.plusSeconds(60));
	}

	@Test
	void permanentFailureIsNotScheduledAgain() {
		when(gateway.analyze(1L)).thenThrow(
			new PostAnalysisFailureException("invalid", "INVALID_RESPONSE", false));

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
		assertThat(analysis.getNextAttemptAt()).isNull();
		assertThat(analysis.getLastFailureCode()).isEqualTo("INVALID_RESPONSE");
	}

	@Test
	void changedPostDiscardsResultAndResetsRetryMetadata() {
		Instant changedAt = STABLE_UPDATED_AT.plusSeconds(1);
		when(post.getUpdatedAt()).thenReturn(
			STABLE_UPDATED_AT,
			STABLE_UPDATED_AT,
			STABLE_UPDATED_AT,
			changedAt);
		when(gateway.analyze(1L)).thenReturn("폐기할 결과");

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.PENDING);
		assertThat(analysis.getAttemptCount()).isZero();
		assertThat(analysis.getSummary()).isNull();
		assertThat(analysis.getClaimToken()).isNull();
	}
}
