package com.ssafy.s15p11b104.global.exception;

import org.springframework.http.HttpStatus;

/**
 * API 계약에 정의된 오류 코드와 대응 HTTP 상태, 응답 문구를 정의한다.
 *
 * <p>계약에 없는 오류 코드를 임의로 추가하지 않는다.
 */
public enum ErrorCode {

	INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식 또는 검증 실패"),
	UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Access Token 없음·만료·위조"),
	INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 일치하지 않습니다."),
	INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "Refresh Token 만료·위조·폐기"),
	FORBIDDEN(HttpStatus.FORBIDDEN, "역할 또는 리소스 접근 권한 부족"),
	LOGIN_ID_DUPLICATED(HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디"),
	MANAGER_TRANSFER_REQUIRED(HttpStatus.CONFLICT, "다른 활성 구성원에게 관리자 권한을 위임한 후 탈퇴해야 함");

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
