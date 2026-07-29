package com.ssafy.s15p11b104.global.exception;

import org.springframework.http.HttpStatus;

/**
 * API 계약에 정의된 오류 코드와 대응 HTTP 상태, 응답 문구를 정의한다.
 *
 * <p>계약에 없는 오류 코드를 임의로 추가하지 않는다.
 */
public enum ErrorCode {

	FORBIDDEN(HttpStatus.FORBIDDEN, "\uad8c\ud55c\uc774 \uc5c6\uc2b5\ub2c8\ub2e4."),

	INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식 또는 검증 실패"),
	UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 일치하지 않습니다."),
	LOGIN_ID_DUPLICATED(HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디");

	private final HttpStatus status;
	private final String message;

	ErrorCode(HttpStatus status, String message) {
		this.status = status;
		this.message = message;
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getMessage() {
		return message;
	}
}
