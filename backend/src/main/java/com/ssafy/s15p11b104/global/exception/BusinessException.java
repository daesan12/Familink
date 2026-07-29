package com.ssafy.s15p11b104.global.exception;

/**
 * API 계약에 정의된 오류 코드로 처리해야 하는 예외다.
 */
public class BusinessException extends RuntimeException {

	private final ErrorCode errorCode;

	public BusinessException(ErrorCode errorCode) {
		super(errorCode.getMessage());
		this.errorCode = errorCode;
	}

	public ErrorCode getErrorCode() {
		return errorCode;
	}
}
