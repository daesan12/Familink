package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.isNull;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisGateway;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisService;

import jakarta.persistence.EntityManager;

@ExtendWith(MockitoExtension.class)
class PostAnalysisServiceTest {

	private static final Instant STABLE_UPDATED_AT = Instant.parse("2026-07-29T00:00:00Z");

	@Mock
	private PostRepository postRepository;

	@Mock
	private PostAnalysisRepository postAnalysisRepository;

	@Mock
	private ObjectProvider<PostAnalysisGateway> gatewayProvider;

	@Mock
	private ObjectProvider<EntityManager> entityManagerProvider;

	@Mock
	private PostAnalysisGateway gateway;

	@Mock
	private Post post;

	private PostAnalysisService service;

	@BeforeEach
	void setUp() {
		service = new PostAnalysisService(
			postRepository, postAnalysisRepository, gatewayProvider, entityManagerProvider);
		when(gatewayProvider.getIfAvailable()).thenReturn(gateway);
		lenient().when(entityManagerProvider.getIfAvailable()).thenReturn(null);
		when(postRepository.findById(1L)).thenReturn(Optional.of(post));
		when(post.getUpdatedAt()).thenReturn(STABLE_UPDATED_AT);
		when(postAnalysisRepository.findStablePostIds(any(), any())).thenReturn(List.of(1L));
	}

	@Test
	void stablePostStoresTrimmedSummaryAsSuccess() {
		PostAnalysis analysis = new PostAnalysis(post, AnalysisStatus.PENDING);
		when(postAnalysisRepository.findByPostId(1L)).thenReturn(Optional.empty());
		when(postAnalysisRepository.save(any(PostAnalysis.class))).thenReturn(analysis);
		when(postAnalysisRepository.completeIfPostUnchanged(isNull(), any(), any(), any())).thenReturn(1);
		when(gateway.analyze(1L)).thenReturn("  가족과 산책한 이야기  ");

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.SUCCESS);
		assertThat(analysis.getSummary()).isEqualTo("가족과 산책한 이야기");
		assertThat(analysis.getAnalyzedAt()).isNotNull();
		verify(gateway).analyze(1L);
	}

	@Test
	void gatewayFailureStoresFailedWithoutResult() {
		PostAnalysis analysis = new PostAnalysis(post, AnalysisStatus.PENDING);
		when(postAnalysisRepository.findByPostId(1L)).thenReturn(Optional.of(analysis));
		when(gateway.analyze(1L)).thenThrow(new IllegalStateException("upstream failure"));

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
		assertThat(analysis.getSummary()).isNull();
		assertThat(analysis.getAnalyzedAt()).isNull();
	}

	@Test
	void invalidSummaryStoresFailed() {
		PostAnalysis analysis = new PostAnalysis(post, AnalysisStatus.PENDING);
		when(postAnalysisRepository.findByPostId(1L)).thenReturn(Optional.of(analysis));
		when(gateway.analyze(1L)).thenReturn(" ");

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
		assertThat(analysis.getSummary()).isNull();
		assertThat(analysis.getAnalyzedAt()).isNull();
	}

	@Test
	void successfulAnalysisIsRetriedByResettingExistingRow() {
		PostAnalysis analysis = new PostAnalysis(post, AnalysisStatus.SUCCESS);
		analysis.complete("이전 결과", Instant.now());
		when(postAnalysisRepository.findByPostId(1L)).thenReturn(Optional.of(analysis));
		when(postAnalysisRepository.completeIfPostUnchanged(isNull(), any(), any(), any())).thenReturn(1);
		when(gateway.analyze(1L)).thenReturn("새 결과");

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.SUCCESS);
		assertThat(analysis.getSummary()).isEqualTo("새 결과");
		verify(postAnalysisRepository, never()).save(any(PostAnalysis.class));
	}

	@Test
	void resultIsKeptPendingWhenPostVersionChangedBeforeSave() {
		PostAnalysis analysis = new PostAnalysis(post, AnalysisStatus.PENDING);
		when(postAnalysisRepository.findByPostId(1L)).thenReturn(Optional.of(analysis));
		when(postAnalysisRepository.completeIfPostUnchanged(isNull(), any(), any(), any())).thenReturn(0);
		when(gateway.analyze(1L)).thenReturn("분석 결과");

		service.analyzeStablePosts();

		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.PENDING);
		assertThat(analysis.getSummary()).isNull();
		assertThat(analysis.getAnalyzedAt()).isNull();
	}
}
