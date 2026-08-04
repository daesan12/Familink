package com.ssafy.s15p11b104.global.exception;

/**
 * API 계약에 정의된 오류 코드로 처리해야 하는 예외다.
 */
public class BusinessException extends RuntimeException {

	private final ErrorCode errorCode;
	private final String field;
	private final String detailMessage;

	public BusinessException(ErrorCode errorCode) {
		super(errorCode.getMessage());
		this.errorCode = errorCode;
		this.field = null;
		this.detailMessage = null;
	}

	public BusinessException(ErrorCode errorCode, String field, String detailMessage) {
		super(errorCode.getMessage());
		this.errorCode = errorCode;
		this.field = field;
		this.detailMessage = detailMessage;
	}

	public ErrorCode getErrorCode() {
		return errorCode;
	}

	public String getField() {
		return field;
	}

	public String getDetailMessage() {
		return detailMessage;
	}
}
