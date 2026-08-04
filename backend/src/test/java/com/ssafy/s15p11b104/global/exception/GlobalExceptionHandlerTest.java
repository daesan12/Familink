package com.ssafy.s15p11b104.global.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import com.ssafy.s15p11b104.global.api.ApiErrorResponse;

class GlobalExceptionHandlerTest {

	private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

	@Test
	void includesBusinessValidationDetailWithoutChangingTheCommonMessage() {
		ResponseEntity<ApiErrorResponse> response = handler.handleBusinessException(
			new BusinessException(ErrorCode.INVALID_REQUEST, "media.fileUrl", "사진은 파일당 10MB 이하만 올릴 수 있습니다."));

		assertThat(response.getStatusCode()).isEqualTo(ErrorCode.INVALID_REQUEST.getStatus());
		assertThat(response.getBody()).isNotNull();
		assertThat(response.getBody().message()).isEqualTo(ErrorCode.INVALID_REQUEST.getMessage());
		assertThat(response.getBody().errors()).singleElement().satisfies(error -> {
			assertThat(error.field()).isEqualTo("media.fileUrl");
			assertThat(error.message()).isEqualTo("사진은 파일당 10MB 이하만 올릴 수 있습니다.");
		});
	}
}
