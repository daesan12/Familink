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

import javax.sql.DataSource;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;

import com.google.genai.Client;
import com.google.genai.types.DeleteFileConfig;
import com.google.genai.types.FileState;
import com.google.genai.types.HttpOptions;
import com.google.genai.types.UploadFileConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
 * 실제 GMS를 사용하는 수동 E2E 테스트다.
 *
 * <p>기본 Gradle 테스트에서는 {@code manual-gms} 태그로 제외되며, GMS_API_KEY를 환경 변수로
 * 주입한 별도 명령으로만 실행한다. 미디어 테스트는 로컬 파일을 GMS Files API에 먼저 업로드하고,
 * 반환된 URI를 DB의 PostMedia에 저장해 실제 분석 경로에 사용한다.
 */
@Tag("manual-gms")
@Transactional
class GeminiPostContentE2eTest extends IntegrationTest {

	private static final String TEXT_MODEL = "gemini-2.5-flash-lite";
	private static final String MULTIMODAL_MODEL = "gemini-3.5-flash";

	@Autowired
	private PostContentAnalysisService analysisService;

	@Autowired
	private PostContentInputLoader inputLoader;

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

	@Autowired
	private ObjectMapper objectMapper;

	@MockitoBean
	private MediaMimeTypeProvider mimeTypeProvider;

	@Value("${gemini.analysis.base-url}")
	private String geminiBaseUrl;

	@Value("${gemini.analysis.text-model}")
	private String textModel;

	@Test
	void analyzesDatabasePostWithRealGmsAndWritesRedactedArtifacts() throws Exception {
		String apiKey = System.getenv("GMS_API_KEY");
		assertThat(apiKey).as("GMS_API_KEY must be provided for manual GMS E2E").isNotBlank();
		assertThat(environment.acceptsProfiles("test")).isTrue();
		assertThat(textModel).isEqualTo(TEXT_MODEL);

		try (Connection connection = dataSource.getConnection()) {
			assertThat(connection.getMetaData().getURL()).isEqualTo(postgresJdbcUrl());
		}

		String content = requiredValue("GEMINI_E2E_TEXT_CONTENT");
		List<String> coreKeywords = Stream.of(requiredValue("GEMINI_E2E_EXPECTED_KEYWORDS").split(","))
			.map(String::trim)
			.filter(keyword -> !keyword.isBlank())
			.toList();
		assertThat(coreKeywords).hasSizeGreaterThanOrEqualTo(2);
		Post post = savePost(content);
		entityManager.flush();
		Long postId = post.getId();
		entityManager.clear();

		PostContentInput dbInput = inputLoader.load(postId);
		Path artifactDirectory = Files.createTempDirectory("S15P11B104-gemini-e2e-");
		System.out.println("GMS_E2E_ARTIFACT_DIR=" + artifactDirectory.toAbsolutePath());
		writeRequestArtifact(artifactDirectory, postId, dbInput, textModel);

		String summary = analysisService.analyze(postId);

		assertThat(dbInput.content()).isEqualTo(content);
		assertThat(dbInput.media()).isEmpty();
		assertThat(summary).isNotBlank();
		assertThat(summary.codePointCount(0, summary.length())).isLessThanOrEqualTo(500);
		long matchedKeywords = coreKeywords.stream().filter(summary::contains).count();
		assertThat(matchedKeywords).as("summary should preserve the post's core meaning").isGreaterThanOrEqualTo(2);

		writeResultArtifacts(artifactDirectory, postId, textModel, summary, dbInput.media().size());

		assertArtifactsDoNotContainApiKey(artifactDirectory, apiKey);
	}

	@Test
	void analyzesFourLocalPhotosFromDatabaseWithRealGms() throws Exception {
		String apiKey = requireApiKey();
		String content = requiredValue("GEMINI_E2E_PHOTO_CONTENT");
		List<Path> localPhotos = List.of(
			requiredPath("GEMINI_E2E_IMAGE1"),
			requiredPath("GEMINI_E2E_IMAGE2"),
			requiredPath("GEMINI_E2E_IMAGE3"),
			requiredPath("GEMINI_E2E_IMAGE4"));
		assertThat(localPhotos).allSatisfy(path -> assertThat(Files.isRegularFile(path)).isTrue());

		Client gmsClient = gmsClient(apiKey);
		List<UploadedMedia> uploaded = new ArrayList<>();
		try {
			for (Path photo : localPhotos) {
				assertFileMime(photo, "image/jpeg");
				uploaded.add(upload(gmsClient, photo, "image/jpeg"));
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
			Path artifactDirectory = Files.createTempDirectory("S15P11B104-gemini-photo-e2e-");
			System.out.println("GMS_PHOTO_E2E_ARTIFACT_DIR=" + artifactDirectory.toAbsolutePath());
			writeRequestArtifact(artifactDirectory, postId, dbInput, MULTIMODAL_MODEL);
			String summary = analysisService.analyze(postId);

			assertThat(dbInput.media()).hasSize(4);
			assertThat(dbInput.media()).extracting(PostContentMedia::uri)
				.containsExactly(uploaded.get(0).uri(), uploaded.get(1).uri(), uploaded.get(2).uri(), uploaded.get(3).uri());
			assertThat(summary).isNotBlank();
			assertThat(summary.codePointCount(0, summary.length())).isLessThanOrEqualTo(500);
			writeResultArtifacts(artifactDirectory, postId, MULTIMODAL_MODEL, summary, dbInput.media().size());
			assertArtifactsDoNotContainApiKey(artifactDirectory, apiKey);
		} finally {
			deleteUploadedFiles(gmsClient, uploaded);
		}
	}

	@Test
	void analyzesLocalVideoFromDatabaseWithRealGms() throws Exception {
		String apiKey = requireApiKey();
		String content = requiredValue("GEMINI_E2E_VIDEO_CONTENT");
		Path localVideo = requiredPath("GEMINI_E2E_VIDEO");
		assertThat(Files.isRegularFile(localVideo)).isTrue();
		assertFileMime(localVideo, "video/mp4");

		Client gmsClient = gmsClient(apiKey);
		List<UploadedMedia> uploaded = new ArrayList<>();
		try {
			uploaded.add(upload(gmsClient, localVideo, "video/mp4"));
			Post post = savePost(content);
			postMediaRepository.save(media(post, uploaded.get(0), 1, MediaType.VIDEO));
			entityManager.flush();
			Long postId = post.getId();
			entityManager.clear();
			stubMimeTypes(uploaded, "video/mp4");

			PostContentInput dbInput = inputLoader.load(postId);
			Path artifactDirectory = Files.createTempDirectory("S15P11B104-gemini-video-e2e-");
			System.out.println("GMS_VIDEO_E2E_ARTIFACT_DIR=" + artifactDirectory.toAbsolutePath());
			writeRequestArtifact(artifactDirectory, postId, dbInput, MULTIMODAL_MODEL);
			String summary = analysisService.analyze(postId);

			assertThat(dbInput.media()).containsExactly(
				new PostContentMedia(MediaType.VIDEO, uploaded.get(0).uri(), "video/mp4"));
			assertThat(summary).isNotBlank();
			assertThat(summary.codePointCount(0, summary.length())).isLessThanOrEqualTo(500);
			writeResultArtifacts(artifactDirectory, postId, MULTIMODAL_MODEL, summary, dbInput.media().size());
			assertArtifactsDoNotContainApiKey(artifactDirectory, apiKey);
		} finally {
			deleteUploadedFiles(gmsClient, uploaded);
		}
	}

	private void writeRequestArtifact(Path directory, Long postId, PostContentInput input, String model) throws Exception {
		ObjectNode request = objectMapper.createObjectNode();
		request.put("postId", postId);
		request.put("model", model);
		request.put("gmsEndpoint", geminiBaseUrl + "/v1beta/models/" + model + ":generateContent");
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

	private void writeResultArtifacts(Path directory, Long postId, String model, String summary, int mediaCount)
		throws Exception {
		writeJson(directory.resolve("response.json"), objectMapper.createObjectNode()
			.put("source", "GoogleGeminiGateway response.text()")
			.put("summary", summary));
		writeJson(directory.resolve("analysis-result.json"), objectMapper.createObjectNode()
			.put("postId", postId)
			.put("model", model)
			.put("mediaCount", mediaCount)
			.put("summary", summary)
			.put("summaryCodePoints", summary.codePointCount(0, summary.length())));
	}

	private String requireApiKey() {
		String apiKey = System.getenv("GMS_API_KEY");
		assertThat(apiKey).as("GMS_API_KEY must be provided for manual GMS E2E").isNotBlank();
		return apiKey;
	}

	private Path requiredPath(String environmentName) {
		return Path.of(requiredValue(environmentName));
	}

	private String requiredValue(String environmentName) {
		String value = System.getenv(environmentName);
		assertThat(value).as(environmentName + " must be provided for manual GMS E2E").isNotBlank();
		return value;
	}

	private void assertFileMime(Path path, String expectedMimeType) throws Exception {
		String detectedMimeType = Files.probeContentType(path);
		assertThat(detectedMimeType).as("MIME type for " + path.getFileName()).isEqualTo(expectedMimeType);
	}

	private Client gmsClient(String apiKey) {
		return Client.builder()
			.apiKey(apiKey)
			.httpOptions(HttpOptions.builder()
				.baseUrl(geminiBaseUrl)
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
			ready.uri().orElseThrow(() -> new IllegalStateException("GMS file URI is missing")),
			mimeType,
			ready.name().orElseThrow(() -> new IllegalStateException("GMS file name is missing")));
	}

	private com.google.genai.types.File waitForFile(Client client, com.google.genai.types.File file) {
		String name = file.name().orElseThrow(() -> new IllegalStateException("GMS file name is missing"));
		com.google.genai.types.File current = file;
		for (int attempt = 0; attempt < 90; attempt++) {
			FileState.Known state = current.state().map(FileState::knownEnum).orElse(null);
			if (state == FileState.Known.ACTIVE) {
				return current;
			}
			if (state == FileState.Known.FAILED) {
				throw new IllegalStateException("GMS file processing failed: " + name);
			}
			try {
				TimeUnit.SECONDS.sleep(1);
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("Interrupted while waiting for GMS file", exception);
			}
			current = client.files.get(name, null);
		}
		throw new IllegalStateException("Timed out waiting for GMS file: " + name);
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
				// GMS files have an expiration policy; cleanup failure must not hide the test result.
			}
		});
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
					throw new AssertionError("Failed to inspect GMS E2E artifact: " + path, exception);
				}
			});
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
		return media(post, uploaded, displayOrder, MediaType.IMAGE);
	}

	private PostMedia media(Post post, UploadedMedia uploaded, int displayOrder, MediaType mediaType) {
		return new PostMedia(post, mediaType, uploaded.uri(), displayOrder, null);
	}

	private record UploadedMedia(String uri, String mimeType, String name) {
	}
}
