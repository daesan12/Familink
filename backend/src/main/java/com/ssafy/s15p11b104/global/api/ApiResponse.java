package com.ssafy.s15p11b104.global.api;

/**
 * 모든 API가 공유하는 공통 응답 봉투다.
 *
 * <p>본문이 없는 {@code 204 No Content} 응답에는 이 봉투를 사용하지 않는다.
 *
 * @param success 요청 처리 성공 여부
 * @param data    성공 시 API 계약에 정의된 응답 본문, 실패 시 {@code null}
 * @param error   실패 시 오류 정보, 성공 시 {@code null}
 * @param <T>     성공 응답 본문 타입
 */
public record ApiResponse<T>(boolean success, T data, ApiError error) {

	public static <T> ApiResponse<T> success(T data) {
		return new ApiResponse<>(true, data, null);
	}

	public static <T> ApiResponse<T> failure(ApiError error) {
		return new ApiResponse<>(false, null, error);
	}
}
