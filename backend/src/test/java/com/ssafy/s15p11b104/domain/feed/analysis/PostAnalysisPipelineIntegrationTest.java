package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisGateway;
import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisScheduler;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;

@Transactional
class PostAnalysisPipelineIntegrationTest extends IntegrationTest {

	private static final Instant STABLE_UPDATED_AT = Instant.parse("2026-07-29T00:00:00Z");
	private static final String MEDIA_BASE_URL =
		"https://s15p11b104-media-580779787807-ap-northeast-2-an.s3.ap-northeast-2.amazonaws.com/posts/";
	private static final AtomicLong VALUE_SEQUENCE = new AtomicLong();

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private PostMediaRepository postMediaRepository;

	@Autowired
	private PostAnalysisRepository postAnalysisRepository;

	@Autowired
	private PostAnalysisScheduler postAnalysisScheduler;

	@Autowired
	private PostAnalysisGateway postAnalysisGateway;

	@MockitoBean
	private GeminiGateway geminiGateway;

	@MockitoBean
	private S3Client s3Client;

	@BeforeEach
	void setUp() {
		postAnalysisRepository.deleteAll();
		postMediaRepository.deleteAll();
		postRepository.deleteAll();
		groupMemberRepository.deleteAll();
		entityManager.createQuery("delete from FamilyGroup").executeUpdate();
		userRepository.deleteAll();
		entityManager.flush();
	}

	@Test
	void schedulerUsesRealAnalysisGatewayAndStoresTextSummaryOnce() {
		Post post = createStablePost("지난 주말 아이들과 동네 공원에서 봄꽃을 구경하고 함께 뛰어놀았다.");
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary("아이들과 공원에서 봄꽃을 구경하며 즐거운 시간을 보냈다."));

		postAnalysisScheduler.schedule();
		postAnalysisScheduler.schedule();
		entityManager.flush();
		entityManager.clear();

		assertThat(postAnalysisGateway).isInstanceOf(PostContentAnalysisService.class);
		assertSuccess(
			post.getId(),
			"아이들과 공원에서 봄꽃을 구경하며 즐거운 시간을 보냈다.");
		ArgumentCaptor<GeminiRequest> request = ArgumentCaptor.forClass(GeminiRequest.class);
		verify(geminiGateway).generate(request.capture());
		assertThat(request.getValue().model()).isEqualTo("gemini-2.5-flash-lite");
		assertThat(request.getValue().media()).isEmpty();
		verifyNoInteractions(s3Client);
		assertThat(analysisCount(post.getId())).isOne();
	}

	@Test
	void schedulerLoadsFourImagesInDisplayOrderAndStoresSummary() {
		Post post = createPost("가족들과 생일 파티를 열고 케이크를 먹으며 기념사진을 남겼다.");
		List<StoredMedia> expectedMedia = List.of(
			image("family-cake.jpg", "image/jpeg", 1),
			image("family-table.png", "image/png", 2),
			image("birthday-card.webp", "image/webp", 3),
			image("family-photo.jpg", "image/jpeg", 4));
		saveMediaOutOfOrder(post, expectedMedia);
		makeStable(post);
		stubHeadObject(expectedMedia);
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary("가족들이 생일을 축하하며 케이크를 먹고 기념사진을 남겼다."));

		postAnalysisScheduler.schedule();
		entityManager.flush();
		entityManager.clear();

		assertSuccess(
			post.getId(),
			"가족들이 생일을 축하하며 케이크를 먹고 기념사진을 남겼다.");
		assertMultimodalRequest(expectedMedia);
		assertHeadObjectOrder(expectedMedia);
	}

	@Test
	void schedulerLoadsVideoMimeAndStoresSummary() {
		Post post = createPost("아이들이 처음으로 자전거를 타며 끝까지 혼자 달리는 모습을 영상으로 남겼다.");
		List<StoredMedia> expectedMedia = List.of(
			new StoredMedia(MediaType.VIDEO, MEDIA_BASE_URL + "first-bike-ride.mp4", "video/mp4", 1));
		saveMedia(post, expectedMedia);
		makeStable(post);
		stubHeadObject(expectedMedia);
		when(geminiGateway.generate(any(GeminiRequest.class)))
			.thenReturn(responseWithSummary("아이들이 처음으로 자전거를 타고 혼자 달리는 경험을 했다."));

		postAnalysisScheduler.schedule();
		entityManager.flush();
		entityManager.clear();

		assertSuccess(post.getId(), "아이들이 처음으로 자전거를 타고 혼자 달리는 경험을 했다.");
		assertMultimodalRequest(expectedMedia);
		assertHeadObjectOrder(expectedMedia);
	}

	@Test
	void s3FailureStoresFailedStateWithoutCallingGemini() {
		Post post = createPost("가족사진을 정리하며 지난 여행을 떠올렸다.");
		List<StoredMedia> media = List.of(image("missing-photo.jpg", "image/jpeg", 1));
		saveMedia(post, media);
		makeStable(post);
		when(s3Client.headObject(any(HeadObjectRequest.class)))
			.thenThrow(S3Exception.builder().message("head object failed").statusCode(503).build());

		postAnalysisScheduler.schedule();
		entityManager.flush();
		entityManager.clear();

		assertFailed(post.getId());
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void missingMimeStoresFailedStateWithoutCallingGemini() {
		Post post = createPost("함께 찍은 사진을 보며 가족들과 나눈 이야기를 기록했다.");
		List<StoredMedia> media = List.of(image("content-type-missing.jpg", null, 1));
		saveMedia(post, media);
		makeStable(post);
		stubHeadObject(media);

		postAnalysisScheduler.schedule();
		entityManager.flush();
		entityManager.clear();

		assertFailed(post.getId());
		verifyNoInteractions(geminiGateway);
	}

	@Test
	void mismatchedMimeStoresFailedStateWithoutCallingGemini() {
		Post post = createPost("가족사진 한 장과 함께 오늘의 추억을 남겼다.");
		List<StoredMedia> media = List.of(image("wrong-content-type.jpg", "video/mp4", 1));
		saveMedia(post, media);
		makeStable(post);
		stubHeadObject(media);

		postAnalysisScheduler.schedule();
		entityManager.flush();
		entityManager.clear();

		assertFailed(post.getId());
		verifyNoInteractions(geminiGateway);
	}

	private Post createStablePost(String content) {
		Post post = createPost(content);
		makeStable(post);
		return post;
	}

	private Post createPost(String content) {
		long valueId = VALUE_SEQUENCE.incrementAndGet();
		User user = userRepository.save(new User(
			"pipeline_user_" + valueId,
			"password-hash",
			"분석 사용자",
			LocalDate.of(1995, 3, 17),
			UserGender.MALE));
		FamilyGroup group = entityManager.merge(
			new FamilyGroup("분석 그룹", String.format("P%05d", valueId % 100_000)));
		entityManager.flush();
		GroupMember member = groupMemberRepository.save(
			new GroupMember(group, user, GroupRole.GUARDIAN, true, Instant.now()));
		Post post = postRepository.save(new Post(group, member, content));
		entityManager.flush();
		return post;
	}

	private void makeStable(Post post) {
		entityManager.flush();
		jdbcTemplate.update(
			"update posts set updated_at = ? where id = ?",
			Timestamp.from(STABLE_UPDATED_AT),
			post.getId());
		entityManager.clear();
	}

	private StoredMedia image(String fileName, String mimeType, int displayOrder) {
		return new StoredMedia(MediaType.IMAGE, MEDIA_BASE_URL + fileName, mimeType, displayOrder);
	}

	private void saveMediaOutOfOrder(Post post, List<StoredMedia> media) {
		saveMedia(post, List.of(media.get(2), media.get(0), media.get(3), media.get(1)));
	}

	private void saveMedia(Post post, List<StoredMedia> media) {
		postMediaRepository.saveAll(media.stream()
			.map(item -> new PostMedia(
				post,
				item.mediaType(),
				item.uri(),
				item.displayOrder(),
				null))
			.toList());
		entityManager.flush();
	}

	private void stubHeadObject(List<StoredMedia> media) {
		when(s3Client.headObject(any(HeadObjectRequest.class))).thenAnswer(invocation -> {
			HeadObjectRequest request = invocation.getArgument(0, HeadObjectRequest.class);
			StoredMedia storedMedia = media.stream()
				.filter(item -> item.objectKey().equals(request.key()))
				.findFirst()
				.orElseThrow();
			HeadObjectResponse.Builder response = HeadObjectResponse.builder();
			if (storedMedia.mimeType() != null) {
				response.contentType(storedMedia.mimeType());
			}
			return response.build();
		});
	}

	private void assertMultimodalRequest(List<StoredMedia> expectedMedia) {
		ArgumentCaptor<GeminiRequest> request = ArgumentCaptor.forClass(GeminiRequest.class);
		verify(geminiGateway).generate(request.capture());
		assertThat(request.getValue().model()).isEqualTo("gemini-3.5-flash");
		assertThat(request.getValue().media()).containsExactlyElementsOf(expectedMedia.stream()
			.map(StoredMedia::toContentMedia)
			.toList());
	}

	private void assertHeadObjectOrder(List<StoredMedia> expectedMedia) {
		ArgumentCaptor<HeadObjectRequest> request = ArgumentCaptor.forClass(HeadObjectRequest.class);
		verify(s3Client, times(expectedMedia.size())).headObject(request.capture());
		assertThat(request.getAllValues())
			.extracting(HeadObjectRequest::key)
			.containsExactlyElementsOf(expectedMedia.stream().map(StoredMedia::objectKey).toList());
	}

	private void assertSuccess(Long postId, String expectedSummary) {
		PostAnalysis analysis = postAnalysisRepository.findByPostId(postId).orElseThrow();
		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.SUCCESS);
		assertThat(analysis.getSummary()).isEqualTo(expectedSummary);
		assertThat(analysis.getAnalyzedAt()).isNotNull();
		assertThat(analysis.getPost().getId()).isEqualTo(postId);
	}

	private void assertFailed(Long postId) {
		PostAnalysis analysis = postAnalysisRepository.findByPostId(postId).orElseThrow();
		assertThat(analysis.getStatus()).isEqualTo(AnalysisStatus.FAILED);
		assertThat(analysis.getSummary()).isNull();
		assertThat(analysis.getAnalyzedAt()).isNull();
	}

	private int analysisCount(Long postId) {
		return jdbcTemplate.queryForObject(
			"select count(*) from post_analyses where post_id = ?",
			Integer.class,
			postId);
	}

	private String responseWithSummary(String summary) {
		return "{\"summary\":\"" + summary + "\"}";
	}

	private record StoredMedia(MediaType mediaType, String uri, String mimeType, int displayOrder) {

		private String objectKey() {
			return uri.substring(uri.indexOf("/posts/") + 1);
		}

		private PostContentMedia toContentMedia() {
			return new PostContentMedia(mediaType, uri, mimeType);
		}
	}
}
