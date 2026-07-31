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
	INVITE_CODE_INVALID(HttpStatus.BAD_REQUEST, "존재하지 않는 초대 코드"),
	INVALID_JOIN_REQUEST_DECISION(HttpStatus.BAD_REQUEST, "가입 요청 처리 값은 APPROVE 또는 REJECT여야 함"),
	ASSIGNED_ROLE_REQUIRED(HttpStatus.BAD_REQUEST, "승인 시 지정 역할이 필요함"),
	FORBIDDEN(HttpStatus.FORBIDDEN, "역할 또는 리소스 접근 권한 부족"),
	NOT_GROUP_MANAGER(HttpStatus.FORBIDDEN, "그룹 관리자만 수행할 수 있음"),
	NOT_GROUP_MEMBER(HttpStatus.FORBIDDEN, "해당 그룹의 활성 구성원이 아님"),
	JOIN_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND, "가입 요청을 찾을 수 없음"),
	GROUP_MEMBER_NOT_FOUND(HttpStatus.NOT_FOUND, "그룹 구성원을 찾을 수 없음"),
	LOGIN_ID_DUPLICATED(HttpStatus.CONFLICT, "이미 사용 중인 로그인 아이디"),
	MANAGER_TRANSFER_REQUIRED(HttpStatus.CONFLICT, "다른 활성 구성원에게 관리자 권한을 위임한 후 탈퇴해야 함"),
	GROUP_MEMBER_ALREADY_LEFT(HttpStatus.CONFLICT, "이미 그룹을 떠난 구성원"),
	CANNOT_REMOVE_SELF(HttpStatus.CONFLICT, "본인을 내보낼 수 없음"),
	GROUP_HAS_ACTIVE_MEMBERS(HttpStatus.CONFLICT, "다른 활성 구성원이 있는 그룹은 삭제할 수 없음"),
	GROUP_NAME_MISMATCH(HttpStatus.CONFLICT, "확인용 그룹 이름이 그룹 이름과 일치하지 않음"),
	ALREADY_GROUP_MEMBER(HttpStatus.CONFLICT, "이미 해당 그룹의 활성 구성원"),
	JOIN_REQUEST_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 대기 중인 가입 요청이 있음"),
	JOIN_REQUEST_ALREADY_PROCESSED(HttpStatus.CONFLICT, "이미 처리된 가입 요청"),
	CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP(HttpStatus.CONFLICT, "이미 다른 그룹의 활성 피보호자");

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
