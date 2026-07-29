package com.ssafy.s15p11b104.domain.feed.analysis;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.genai.Client;
import com.google.genai.types.DeleteFileConfig;
import com.google.genai.types.FileState;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.UploadFileConfig;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.feed.entity.MediaType;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostMedia;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * Google Gemini Developer API를 직접 사용하는 수동 미디어 E2E 테스트다.
 *
 * <p>기본 Gradle 테스트에서는 {@code manual-gemini} 태그로 제외된다. 실제 파일은 Google
 * Files API에 임시 업로드하고, 반환된 URI만 DB의 PostMedia에 저장한 뒤 postId 기반 분석
 * 경로를 실행한다. 테스트가 끝나면 업로드된 파일은 best-effort로 삭제한다.
 */
@Tag("manual-gemini")
@Transactional
class GeminiDirectApiPostContentE2eTest extends IntegrationTest {

	private static final String DIRECT_BASE_URL = "https://generativelanguage.googleapis.com";
	private static final String MULTIMODAL_MODEL = "gemini-3.5-flash";

	@Autowired
	private PostContentInputLoader inputLoader;

	@Autowired
	private PostRepository postRepository;

	@Autowired
	private PostMediaRepository postMediaRepository;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private javax.sql.DataSource dataSource;

	@Autowired
	private Environment environment;

	@MockitoBean
	private MediaMimeTypeProvider mimeTypeProvider;

	@Test
	void analyzesFourLocalPhotosThroughDirectGeminiApi() throws Exception {
		String apiKey = requireApiKey();
		String content = requiredValue("GEMINI_E2E_PHOTO_CONTENT");
		List<Path> localPhotos = List.of(
			requiredPath("GEMINI_E2E_IMAGE1"),
			requiredPath("GEMINI_E2E_IMAGE2"),
			requiredPath("GEMINI_E2E_IMAGE3"),
			requiredPath("GEMINI_E2E_IMAGE4"));
		assertThat(localPhotos).allSatisfy(path -> assertThat(Files.isRegularFile(path)).isTrue());
		assertTestDatabase();

		Client client = directClient(apiKey);
		List<UploadedMedia> uploaded = new ArrayList<>();
		try {
			for (Path photo : localPhotos) {
				assertFileMime(photo, "image/jpeg");
				uploaded.add(upload(client, photo, "image/jpeg"));
			}

			Post post = savePost(content);
			postMediaRepository.saveAll(List.of(
				media(post, uploaded.get(2), 3),
				media(post, uploaded.get(0), 1),
				media(post, uploaded.get(3), 4),
				media(post, uploaded.get(1), 2)));
			entityManager.flush();
			Long postId = post.getId();
			entityManager.clear();
			stubMimeTypes(uploaded, "image/jpeg");

			PostContentInput dbInput = inputLoader.load(postId);
			Path artifactDirectory = Files.createTempDirectory("S15P11B104-gemini-direct-photo-");
			System.out.println("GEMINI_DIRECT_PHOTO_ARTIFACT_DIR=" + artifactDirectory.toAbsolutePath());
			writeRequestArtifact(artifactDirectory, postId, dbInput);

			String summary = directAnalysisService(apiKey).analyze(postId);

			assertThat(dbInput.content()).isEqualTo(content);
			assertThat(dbInput.media()).extracting(PostContentMedia::uri)
				.containsExactly(uploaded.get(0).uri(), uploaded.get(1).uri(), uploaded.get(2).uri(), uploaded.get(3).uri());
			assertThat(summary).isNotBlank();
			assertThat(summary.codePointCount(0, summary.length())).isLessThanOrEqualTo(500);
			writeResultArtifacts(artifactDirectory, postId, summary, dbInput.media().size());
			assertArtifactsDoNotContainApiKey(artifactDirectory, apiKey);
		} finally {
			deleteUploadedFiles(client, uploaded);
		}
	}

	@Test
	void analyzesLocalVideoThroughDirectGeminiApi() throws Exception {
		String apiKey = requireApiKey();
		String content = requiredValue("GEMINI_E2E_VIDEO_CONTENT");
		Path localVideo = requiredPath("GEMINI_E2E_VIDEO");
		assertThat(Files.isRegularFile(localVideo)).isTrue();
		assertFileMime(localVideo, "video/mp4");
		assertTestDatabase();

		Client client = directClient(apiKey);
		List<UploadedMedia> uploaded = new ArrayList<>();
		try {
			uploaded.add(upload(client, localVideo, "video/mp4"));
			Post post = savePost(content);
			postMediaRepository.save(media(post, uploaded.get(0), 1, MediaType.VIDEO));
			entityManager.flush();
			Long postId = post.getId();
			entityManager.clear();
			stubMimeTypes(uploaded, "video/mp4");

			PostContentInput dbInput = inputLoader.load(postId);
			Path artifactDirectory = Files.createTempDirectory("S15P11B104-gemini-direct-video-");
			System.out.println("GEMINI_DIRECT_VIDEO_ARTIFACT_DIR=" + artifactDirectory.toAbsolutePath());
			writeRequestArtifact(artifactDirectory, postId, dbInput);

			String summary = directAnalysisService(apiKey).analyze(postId);

			assertThat(dbInput.content()).isEqualTo(content);
			assertThat(dbInput.media()).containsExactly(
				new PostContentMedia(MediaType.VIDEO, uploaded.get(0).uri(), "video/mp4"));
			assertThat(summary).isNotBlank();
			assertThat(summary.codePointCount(0, summary.length())).isLessThanOrEqualTo(500);
			writeResultArtifacts(artifactDirectory, postId, summary, dbInput.media().size());
			assertArtifactsDoNotContainApiKey(artifactDirectory, apiKey);
		} finally {
			deleteUploadedFiles(client, uploaded);
		}
	}

	private PostContentAnalysisService directAnalysisService(String apiKey) {
		GeminiPostContentAnalyzer analyzer = new GeminiPostContentAnalyzer(
			new GoogleGeminiGateway(apiKey, DIRECT_BASE_URL),
			objectMapper,
			"gemini-2.5-flash-lite",
			MULTIMODAL_MODEL);
		return new PostContentAnalysisService(inputLoader, analyzer);
	}

	private Client directClient(String apiKey) {
		return Client.builder()
			.apiKey(apiKey)
			.httpOptions(HttpOptions.builder()
				.baseUrl(DIRECT_BASE_URL)
				.apiVersion("v1beta")
				.headers(Map.of("x-goog-api-key", apiKey))
				.build())
			.build();
	}

	private UploadedMedia upload(Client client, Path path, String mimeType) {
		com.google.genai.types.File uploaded = client.files.upload(
			path.toFile(), UploadFileConfig.builder().mimeType(mimeType).build());
		com.google.genai.types.File ready = waitForFile(client, uploaded);
		return new UploadedMedia(
			ready.uri().orElseThrow(() -> new IllegalStateException("Gemini file URI is missing")),
			ready.name().orElseThrow(() -> new IllegalStateException("Gemini file name is missing")));
	}

	private com.google.genai.types.File waitForFile(Client client, com.google.genai.types.File file) {
		String name = file.name().orElseThrow(() -> new IllegalStateException("Gemini file name is missing"));
		com.google.genai.types.File current = file;
		for (int attempt = 0; attempt < 180; attempt++) {
			FileState.Known state = current.state().map(FileState::knownEnum).orElse(null);
			if (state == FileState.Known.ACTIVE) {
				return current;
			}
			if (state == FileState.Known.FAILED) {
				throw new IllegalStateException("Gemini file processing failed: " + name);
			}
			try {
				TimeUnit.SECONDS.sleep(1);
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("Interrupted while waiting for Gemini file", exception);
			}
			current = client.files.get(name, null);
		}
		throw new IllegalStateException("Timed out waiting for Gemini file: " + name);
	}

	private void stubMimeTypes(List<UploadedMedia> uploaded, String mimeType) {
		uploaded.forEach(media -> org.mockito.Mockito.when(mimeTypeProvider.getMimeType(media.uri()))
			.thenReturn(mimeType));
	}

	private void deleteUploadedFiles(Client client, List<UploadedMedia> uploaded) {
		uploaded.forEach(media -> {
			try {
				client.files.delete(media.name(), DeleteFileConfig.builder().build());
			} catch (RuntimeException ignored) {
				// Cleanup failure must not hide the analysis result.
			}
		});
	}

	private void writeRequestArtifact(Path directory, Long postId, PostContentInput input) throws Exception {
		ObjectNode request = objectMapper.createObjectNode()
			.put("postId", postId)
			.put("model", MULTIMODAL_MODEL)
			.put("endpoint", DIRECT_BASE_URL + "/v1beta/models/" + MULTIMODAL_MODEL + ":generateContent");
		request.putObject("headers").put("x-goog-api-key", "[REDACTED]");
		request.putObject("dbInput").put("content", input.content());
		var media = request.putArray("media");
		for (int index = 0; index < input.media().size(); index++) {
			PostContentMedia item = input.media().get(index);
			media.addObject()
				.put("displayOrder", index + 1)
				.put("mediaType", item.mediaType().name())
				.put("uri", item.uri())
				.put("mimeType", item.mimeType());
		}
		writeJson(directory.resolve("request.json"), request);
	}

	private void writeResultArtifacts(Path directory, Long postId, String summary, int mediaCount) throws Exception {
		writeJson(directory.resolve("response.json"), objectMapper.createObjectNode()
			.put("source", "Google Gemini Developer API response.text()")
			.put("summary", summary));
		writeJson(directory.resolve("analysis-result.json"), objectMapper.createObjectNode()
			.put("postId", postId)
			.put("model", MULTIMODAL_MODEL)
			.put("mediaCount", mediaCount)
			.put("summary", summary)
			.put("summaryCodePoints", summary.codePointCount(0, summary.length())));
	}

	private void writeJson(Path path, JsonNode node) throws Exception {
		Files.writeString(path, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(node),
			StandardCharsets.UTF_8);
	}

	private void assertArtifactsDoNotContainApiKey(Path directory, String apiKey) throws Exception {
		try (Stream<Path> files = Files.list(directory)) {
			files.forEach(path -> {
				try {
					assertThat(Files.readString(path, StandardCharsets.UTF_8)).doesNotContain(apiKey);
				} catch (Exception exception) {
					throw new AssertionError("Failed to inspect Gemini E2E artifact: " + path, exception);
				}
			});
		}
	}

	private String requireApiKey() {
		String apiKey = System.getenv("GEMINI_API_KEY");
		assertThat(apiKey).as("GEMINI_API_KEY must be provided for manual Gemini E2E").isNotBlank();
		return apiKey;
	}

	private Path requiredPath(String environmentName) {
		return Path.of(requiredValue(environmentName));
	}

	private String requiredValue(String environmentName) {
		String value = System.getenv(environmentName);
		assertThat(value).as(environmentName + " must be provided for manual Gemini E2E").isNotBlank();
		return value;
	}

	private void assertFileMime(Path path, String expectedMimeType) throws Exception {
		String detectedMimeType = Files.probeContentType(path);
		assertThat(detectedMimeType).as("MIME type for " + path.getFileName()).isEqualTo(expectedMimeType);
	}

	private void assertTestDatabase() throws Exception {
		assertThat(environment.acceptsProfiles("test")).isTrue();
		try (Connection connection = dataSource.getConnection()) {
			assertThat(connection.getMetaData().getURL()).isEqualTo(postgresJdbcUrl());
		}
	}

	private Post savePost(String content) {
		User user = new User("analysis-e2e", "hash", "테스트 가족 사용자", LocalDate.of(1990, 1, 1), UserGender.MALE);
		FamilyGroup group = new FamilyGroup("테스트 가족 기록", "E21234");
		GroupMember member = new GroupMember(group, user, GroupRole.GUARDIAN, true, Instant.now());
		entityManager.persist(user);
		entityManager.persist(group);
		entityManager.persist(member);
		return postRepository.save(new Post(group, member, content));
	}

	private PostMedia media(Post post, UploadedMedia uploaded, int displayOrder) {
		return new PostMedia(post, MediaType.IMAGE, uploaded.uri(), displayOrder, null);
	}

	private PostMedia media(Post post, UploadedMedia uploaded, int displayOrder, MediaType mediaType) {
		return new PostMedia(post, mediaType, uploaded.uri(), displayOrder, null);
	}

	private record UploadedMedia(String uri, String name) {
	}
}
