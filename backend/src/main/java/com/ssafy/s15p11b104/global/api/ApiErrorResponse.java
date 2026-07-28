package com.ssafy.s15p11b104.global.api;

import java.util.List;

import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * 실패 응답의 공통 봉투다.
 *
 * @param success 항상 {@code false}
 * @param code    API 계약에 정의된 오류 코드
 * @param message 오류 원인을 알리는 문구
 * @param errors  검증에 실패한 필드 목록이며, 필드 단위 원인이 없으면 빈 목록이다.
 */
public record ApiErrorResponse(boolean success, String code, String message, List<FieldError> errors) {

	/**
	 * 검증에 실패한 개별 필드다.
	 *
	 * @param field   대상 필드 이름
	 * @param message 해당 필드가 검증에 실패한 이유
	 */
	public record FieldError(String field, String message) {
	}

	public static ApiErrorResponse of(ErrorCode errorCode, List<FieldError> errors) {
		return new ApiErrorResponse(false, errorCode.name(), errorCode.getMessage(), errors);
	}
}
