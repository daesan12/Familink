package com.ssafy.s15p11b104.domain.file;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
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

	private RequestPostProcessor authenticated(Long userId) {
		return authentication(new UsernamePasswordAuthenticationToken(
			new AuthenticatedUser(userId, "test-access-token"), null, List.of()));
	}
}
