package com.ssafy.s15p11b104.global.api;

/**
 * 성공 응답의 공통 봉투다.
 *
 * <p>본문이 없는 {@code 204 No Content} 응답에는 이 봉투를 사용하지 않는다. 실패 응답은
 * {@link ApiErrorResponse}를 사용한다.
 *
 * @param success 항상 {@code true}
 * @param message 처리 결과를 알리는 문구
 * @param data    API 계약에 정의된 응답 본문
 * @param <T>     응답 본문 타입
 */
public record ApiResponse<T>(boolean success, String message, T data) {

	public static <T> ApiResponse<T> success(String message, T data) {
		return new ApiResponse<>(true, message, data);
	}
}
