package com.ssafy.s15p11b104.domain.call.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.ssafy.s15p11b104.domain.call.service.CallApiException;

@RestControllerAdvice(assignableTypes = CallSessionController.class)
public class CallApiExceptionHandler {

	private static final Logger LOGGER = LoggerFactory.getLogger(CallApiExceptionHandler.class);

	@ExceptionHandler(CallApiException.class)
	ResponseEntity<ApiErrorResponse> handleCallApiException(CallApiException exception) {
		return ResponseEntity.status(exception.getStatus())
			.body(ApiErrorResponse.of(exception.getCode(), exception.getMessage()));
	}

	@ExceptionHandler({
		MethodArgumentNotValidException.class,
		HttpMessageNotReadableException.class
	})
	ResponseEntity<ApiErrorResponse> handleInvalidRequest(Exception exception) {
		return ResponseEntity.badRequest()
			.body(ApiErrorResponse.of("INVALID_REQUEST", "요청 형식이 올바르지 않습니다."));
	}

	@ExceptionHandler(Exception.class)
	ResponseEntity<ApiErrorResponse> handleUnexpectedException(Exception exception) {
		LOGGER.error("AI 통화 API 처리 중 예상하지 못한 오류가 발생했습니다.", exception);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(ApiErrorResponse.of("INTERNAL_ERROR", "요청을 처리하지 못했습니다."));
	}
}
