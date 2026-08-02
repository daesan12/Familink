package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.http.HttpStatus;

public class CallApiException extends RuntimeException {

	private final HttpStatus status;
	private final String code;

	public CallApiException(HttpStatus status, String code, String message) {
		super(message);
		this.status = status;
		this.code = code;
	}

	public static CallApiException invalidRequest(String message) {
		return new CallApiException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", message);
	}

	public static CallApiException unauthorized(String message) {
		return new CallApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
	}

	public static CallApiException forbidden(String message) {
		return new CallApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
	}

	public static CallApiException activeCallExists() {
		return new CallApiException(HttpStatus.CONFLICT, "ACTIVE_CALL_EXISTS", "이미 진행 중인 AI 통화가 있습니다.");
	}

	public static CallApiException callSessionNotFound() {
		return new CallApiException(HttpStatus.NOT_FOUND, "CALL_SESSION_NOT_FOUND", "통화 세션을 찾을 수 없습니다.");
	}

	public static CallApiException invalidCallStatus() {
		return new CallApiException(HttpStatus.CONFLICT, "INVALID_CALL_STATUS", "현재 상태에서는 요청을 처리할 수 없습니다.");
	}

	public static CallApiException aiConnectionFailed() {
		return new CallApiException(HttpStatus.BAD_GATEWAY, "AI_CONNECTION_FAILED", "AI 통화 연결에 실패했습니다.");
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}
}
