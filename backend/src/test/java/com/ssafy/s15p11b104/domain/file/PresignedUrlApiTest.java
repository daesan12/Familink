package com.ssafy.s15p11b104.domain.file;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.domain.file.dto.UploadResponse;
import com.ssafy.s15p11b104.domain.file.service.PresignedUploadProvider;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

@AutoConfigureMockMvc
class PresignedUrlApiTest extends IntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@MockBean
	private PresignedUploadProvider uploadProvider;

	@Test
	void authenticatedUserCanRequestPresignedUrls() throws Exception {
		given(uploadProvider.issue(anyString(), any(FileUploadRequest.class)))
			.willReturn(new UploadResponse(
				"https://s3.example/upload",
				"https://s3.example/file.jpg",
				Map.of("Content-Type", "image/jpeg"),
				Instant.parse("2026-07-29T01:00:00Z")));

		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", List.of(Map.of(
						"fileName", "photo.jpg",
						"contentType", "image/jpeg",
						"sizeBytes", 1024))))))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.uploads[0].uploadUrl").value("https://s3.example/upload"))
			.andExpect(jsonPath("$.data.uploads[0].fileUrl").value("https://s3.example/file.jpg"))
			.andExpect(jsonPath("$.data.uploads[0].headers.Content-Type").value("image/jpeg"));

		verify(uploadProvider).issue(anyString(), any(FileUploadRequest.class));
	}

	@Test
	void unauthenticatedRequestIsRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.contentType("application/json")
				.content("{\"purpose\":\"post-media\",\"files\":[]}"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void invalidFileRequestIsRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content("{\"purpose\":\"post-media\",\"files\":[{\"fileName\":\"photo.jpg\",\"contentType\":\"image/jpeg\",\"sizeBytes\":0}]}"))
			.andExpect(status().isBadRequest());
	}

	@Test
	void profileImagePurposeIsSupported() throws Exception {
		given(uploadProvider.issue(anyString(), any(FileUploadRequest.class)))
			.willReturn(new UploadResponse(
				"https://s3.example/upload",
				"https://s3.example/profile-image/file.png",
				Map.of("Content-Type", "image/png", "Content-Length", "1024"),
				Instant.parse("2026-07-29T01:00:00Z")));

		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "profile-image",
					"files", List.of(Map.of(
						"fileName", "me.png",
						"contentType", "image/png",
						"sizeBytes", 1024))))))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.uploads[0].headers.Content-Length").value("1024"));
	}

	@Test
	void normalizedContentTypeIsPassedToProvider() throws Exception {
		given(uploadProvider.issue(anyString(), any(FileUploadRequest.class)))
			.willReturn(new UploadResponse(
				"https://s3.example/upload",
				"https://s3.example/file.jpg",
				Map.of("Content-Type", "image/jpeg", "Content-Length", "1024"),
				Instant.parse("2026-07-29T01:00:00Z")));

		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", List.of(Map.of(
						"fileName", "photo.jpg",
						"contentType", "IMAGE/JPEG; charset=utf-8",
						"sizeBytes", 1024))))))
			.andExpect(status().isCreated());

		ArgumentCaptor<FileUploadRequest> captor = ArgumentCaptor.forClass(FileUploadRequest.class);
		verify(uploadProvider).issue(anyString(), captor.capture());
		assertThat(captor.getValue().contentType()).isEqualTo("image/jpeg");
	}

	@Test
	void emptyFilesAreRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content("{\"purpose\":\"post-media\",\"files\":[]}"))
			.andExpect(status().isBadRequest());

		verifyNoInteractions(uploadProvider);
	}

	@Test
	void unknownPurposeIsRejectedWithoutIssuingUrls() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "avatar",
					"files", List.of(Map.of(
						"fileName", "document.pdf",
						"contentType", "application/pdf",
						"sizeBytes", 1024))))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("purpose"))
			.andExpect(jsonPath("$.errors[0].message")
				.value("지원하지 않는 파일 업로드 목적입니다."));

		verifyNoInteractions(uploadProvider);
	}

	@Test
	void unsupportedContentTypeIsRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", List.of(Map.of(
						"fileName", "document.pdf",
						"contentType", "application/pdf",
						"sizeBytes", 1024))))))
			.andExpect(status().isBadRequest());

		verifyNoInteractions(uploadProvider);
	}

	@Test
	void tooManyFilesAreRejected() throws Exception {
		List<Map<String, Object>> files = Collections.nCopies(5, Map.of(
			"fileName", "photo.jpg",
			"contentType", "image/jpeg",
			"sizeBytes", 1024));

		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", files))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("files"));

		verifyNoInteractions(uploadProvider);
	}

	@Test
	void fileNameWithPathSeparatorIsRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", List.of(Map.of(
						"fileName", "a/b.jpg",
						"contentType", "image/jpeg",
						"sizeBytes", 1024))))))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.errors[0].field").value("files[0].fileName"));

		verifyNoInteractions(uploadProvider);
	}

	@Test
	void mixedMediaIsRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", List.of(
						Map.of("fileName", "photo.jpg", "contentType", "image/jpeg", "sizeBytes", 1024),
						Map.of("fileName", "movie.mp4", "contentType", "video/mp4", "sizeBytes", 1024))))))
			.andExpect(status().isBadRequest());

		verifyNoInteractions(uploadProvider);
	}

	@Test
	void imageAboveSizeLimitIsRejected() throws Exception {
		mockMvc.perform(post("/files/presigned-urls")
				.with(authenticated(1L))
				.contentType("application/json")
				.content(objectMapper.writeValueAsString(Map.of(
					"purpose", "post-media",
					"files", List.of(Map.of(
						"fileName", "photo.jpg",
						"contentType", "image/jpeg",
						"sizeBytes", 10_485_761L))))))
			.andExpect(status().isBadRequest());

		verifyNoInteractions(uploadProvider);
	}

	private RequestPostProcessor authenticated(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}
}
