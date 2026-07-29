package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

@Transactional
@TestPropertySource(properties = "gemini.analysis.api-key=")
class PostContentAnalysisIntegrationTest extends IntegrationTest {

	@Autowired
	private PostContentAnalysisService analysisService;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private PostMediaRepository postMediaRepository;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private DataSource dataSource;

	@Autowired
	private Environment environment;

	@MockitoBean
	private GeminiGateway geminiGateway;

	@MockitoBean
	private MediaMimeTypeProvider mimeTypeProvider;

	@Test
	void usesTestProfileAndTestcontainersPostgres() throws SQLException {
		assertThat(environment.acceptsProfiles("test")).isTrue();

		try (Connection connection = dataSource.getConnection()) {
			assertThat(connection.getMetaData().getURL()).isEqualTo(postgresJdbcUrl());
		}
	}

	@Test
	void analyzesTextPostWithTextModelWithoutMimeProvider() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.textPost();
		Post post = savePost(fixture.content());
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary(fixture.expectedSummary()));

		String summary = analyzeFromDatabase(post.getId());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		ArgumentCaptor<GeminiRequest> request = ArgumentCaptor.forClass(GeminiRequest.class);
		verify(geminiGateway).generate(request.capture());
		assertThat(request.getValue().model()).isEqualTo("gemini-2.5-flash-lite");
		assertThat(request.getValue().media()).isEmpty();
		assertThat(request.getValue().prompt()).contains(fixture.content());
		verifyNoInteractions(mimeTypeProvider);
	}

	@Test
	void analyzesImagePostInDisplayOrderWithProvidedMimeTypes() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.photoPost();
		Post post = savePost(fixture.content());
		AnalysisTestFixtures.MediaFixture firstFixture = fixture.media().get(0);
		AnalysisTestFixtures.MediaFixture secondFixture = fixture.media().get(1);
		AnalysisTestFixtures.MediaFixture thirdFixture = fixture.media().get(2);
		AnalysisTestFixtures.MediaFixture fourthFixture = fixture.media().get(3);
		PostMedia first = media(post, firstFixture);
		PostMedia second = media(post, secondFixture);
		PostMedia third = media(post, thirdFixture);
		PostMedia fourth = media(post, fourthFixture);
		postMediaRepository.saveAll(List.of(third, first, fourth, second));
		when(mimeTypeProvider.getMimeType(anyString())).thenAnswer(invocation ->
			Map.of(
				firstFixture.uri(), firstFixture.mimeType(),
				secondFixture.uri(), secondFixture.mimeType(),
				thirdFixture.uri(), thirdFixture.mimeType(),
				fourthFixture.uri(), fourthFixture.mimeType())
				.get(invocation.getArgument(0, String.class)));
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary(fixture.expectedSummary()));

		String summary = analyzeFromDatabase(post.getId());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		ArgumentCaptor<GeminiRequest> request = ArgumentCaptor.forClass(GeminiRequest.class);
		verify(geminiGateway).generate(request.capture());
		assertThat(request.getValue().model()).isEqualTo("gemini-3.5-flash");
		assertThat(request.getValue().media()).containsExactlyElementsOf(
			fixture.media().stream().map(AnalysisTestFixtures.MediaFixture::toContentMedia).toList());
		assertThat(request.getValue().prompt()).contains(fixture.content());
	}

	@Test
	void analyzesSingleImagePostWithMultimodalModel() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.photoPost();
		AnalysisTestFixtures.MediaFixture imageFixture = fixture.media().get(0);
		Post post = savePost(fixture.content());
		PostMedia image = media(post, imageFixture);
		postMediaRepository.save(image);
		when(mimeTypeProvider.getMimeType(image.getFileUrl())).thenReturn("image/jpeg");
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary(fixture.expectedSummary()));

		String summary = analyzeFromDatabase(post.getId());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		ArgumentCaptor<GeminiRequest> request = ArgumentCaptor.forClass(GeminiRequest.class);
		verify(geminiGateway).generate(request.capture());
		assertThat(request.getValue().model()).isEqualTo("gemini-3.5-flash");
		assertThat(request.getValue().media())
			.containsExactly(imageFixture.toContentMedia());
		assertThat(request.getValue().prompt()).contains(fixture.content());
	}

	@Test
	void analyzesVideoPostWithVideoModelAndMimeType() {
		AnalysisTestFixtures.PostFixture fixture = AnalysisTestFixtures.videoPost();
		AnalysisTestFixtures.MediaFixture videoFixture = fixture.media().get(0);
		Post post = savePost(fixture.content());
		PostMedia video = media(post, videoFixture);
		postMediaRepository.save(video);
		when(mimeTypeProvider.getMimeType(video.getFileUrl())).thenReturn("video/mp4");
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary(fixture.expectedSummary()));

		String summary = analyzeFromDatabase(post.getId());

		assertThat(summary).isEqualTo(fixture.expectedSummary());
		ArgumentCaptor<GeminiRequest> request = ArgumentCaptor.forClass(GeminiRequest.class);
		verify(geminiGateway).generate(request.capture());
		assertThat(request.getValue().model()).isEqualTo("gemini-3.5-flash");
		assertThat(request.getValue().media())
			.containsExactly(videoFixture.toContentMedia());
		assertThat(request.getValue().prompt()).contains(fixture.content());
	}

	@Test
	void rejectsMissingPostBeforeCallingDependencies() {
		assertFailure(999_999L, AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway, mimeTypeProvider);
	}

	@Test
	void rejectsFiveImagesWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.photoPost().content());
		List<PostMedia> media = java.util.stream.IntStream.rangeClosed(1, 5)
			.mapToObj(order -> media(post, mediaUri("https", "jpg"), order))
			.toList();
		postMediaRepository.saveAll(media);
		when(mimeTypeProvider.getMimeType(anyString())).thenReturn("image/jpeg");

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void rejectsTwoVideosWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.videoPost().content());
		postMediaRepository.saveAll(List.of(
			media(post, mediaUri("https", "mp4"), 1, MediaType.VIDEO),
			media(post, mediaUri("https", "mp4"), 2, MediaType.VIDEO)));
		when(mimeTypeProvider.getMimeType(anyString())).thenReturn("video/mp4");

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void rejectsMixedMediaWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.photoPost().content());
		postMediaRepository.saveAll(List.of(
			media(post, mediaUri("https", "jpg"), 1, MediaType.IMAGE),
			media(post, mediaUri("https", "mp4"), 2, MediaType.VIDEO)));
		when(mimeTypeProvider.getMimeType(anyString())).thenAnswer(invocation ->
			invocation.getArgument(0, String.class).endsWith(".jpg") ? "image/jpeg" : "video/mp4");

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void rejectsHttpUriWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.photoPost().content());
		PostMedia media = media(post, mediaUri("http", "jpg"), 1);
		postMediaRepository.save(media);
		when(mimeTypeProvider.getMimeType(media.getFileUrl())).thenReturn("image/jpeg");

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void rejectsMissingMimeWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.photoPost().content());
		PostMedia media = media(post, mediaUri("https", "jpg"), 1);
		postMediaRepository.save(media);
		when(mimeTypeProvider.getMimeType(media.getFileUrl())).thenReturn(null);

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void rejectsImageWithVideoMimeWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.photoPost().content());
		PostMedia media = media(post, mediaUri("https", "jpg"), 1);
		postMediaRepository.save(media);
		when(mimeTypeProvider.getMimeType(media.getFileUrl())).thenReturn("video/mp4");

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void rejectsVideoWithImageMimeWithoutCallingGateway() {
		Post post = savePost(AnalysisTestFixtures.videoPost().content());
		PostMedia media = media(post, mediaUri("https", "mp4"), 1, MediaType.VIDEO);
		postMediaRepository.save(media);
		when(mimeTypeProvider.getMimeType(media.getFileUrl())).thenReturn("image/jpeg");

		assertFailure(post.getId(), AnalysisFailureType.INVALID_INPUT);
		verifyNoInteractions(geminiGateway);
	}

	private void assertFailure(Long postId, AnalysisFailureType expectedType) {
		assertThatThrownBy(() -> analyzeFromDatabase(postId))
			.isInstanceOfSatisfying(PostContentAnalysisException.class, exception ->
				assertThat(exception.getType()).isEqualTo(expectedType));
	}

	private String analyzeFromDatabase(Long postId) {
		entityManager.flush();
		entityManager.clear();
		return analysisService.analyze(postId);
	}

	private Post savePost(String content) {
		User user = new User("analysis-user", "hash", "테스트 사용자", LocalDate.of(1990, 1, 1), UserGender.MALE);
		FamilyGroup group = new FamilyGroup("테스트 그룹", "AB1234");
		GroupMember member = new GroupMember(group, user, GroupRole.GUARDIAN, true, Instant.now());
		entityManager.persist(user);
		entityManager.persist(group);
		entityManager.persist(member);
		return postRepository.save(new Post(group, member, content));
	}

	private PostMedia media(Post post, String fileUrl, int displayOrder) {
		return media(post, fileUrl, displayOrder, MediaType.IMAGE);
	}

	private PostMedia media(Post post, String fileUrl, int displayOrder, MediaType mediaType) {
		return new PostMedia(post, mediaType, fileUrl, displayOrder, null);
	}

	private PostMedia media(Post post, AnalysisTestFixtures.MediaFixture fixture) {
		return new PostMedia(post, fixture.mediaType(), fixture.uri(), fixture.displayOrder(), null);
	}

	private String mediaUri(String scheme, String extension) {
		return AnalysisTestFixtures.mediaUri(scheme, extension);
	}

	private String responseWithSummary(String summary) {
		return "{\"summary\":\"" + summary + "\"}";
	}
}
