package com.ssafy.s15p11b104.global.api;

/**
 * 실패 응답 봉투의 오류 정보를 담는다.
 *
 * @param code    API 계약에 정의된 오류 코드
 * @param message 오류 원인에 대한 사람이 읽을 수 있는 설명
 */
public record ApiError(String code, String message) {
}
