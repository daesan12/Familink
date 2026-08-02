package com.ssafy.s15p11b104.domain.call.controller;

public record ApiErrorResponse(
	ErrorBody error
) {

	public record ErrorBody(
		String code,
		String message
	) {
	}

	public static ApiErrorResponse of(String code, String message) {
		return new ApiErrorResponse(new ErrorBody(code, message));
	}
}
