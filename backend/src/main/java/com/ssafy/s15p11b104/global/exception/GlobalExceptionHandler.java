package com.ssafy.s15p11b104.global.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.ssafy.s15p11b104.global.api.ApiError;
import com.ssafy.s15p11b104.global.api.ApiResponse;

import jakarta.validation.ConstraintViolationException;

/**
 * 계약에 정의된 오류 코드를 공통 응답 봉투로 변환한다.
 *
 * <p>계약에 없는 오류 코드를 만들지 않기 위해 예상하지 못한 예외는 처리하지 않고
 * 프레임워크 기본 처리에 맡긴다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(BusinessException.class)
	ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException exception) {
		return toResponse(exception.getErrorCode());
	}

	@ExceptionHandler({
		MethodArgumentNotValidException.class,
		HandlerMethodValidationException.class,
		ConstraintViolationException.class,
		MissingServletRequestParameterException.class,
		MethodArgumentTypeMismatchException.class,
		HttpMessageNotReadableException.class
	})
	ResponseEntity<ApiResponse<Void>> handleInvalidRequest() {
		return toResponse(ErrorCode.INVALID_REQUEST);
	}

	private ResponseEntity<ApiResponse<Void>> toResponse(ErrorCode errorCode) {
		ApiError error = new ApiError(errorCode.name(), errorCode.getDefaultMessage());
		return ResponseEntity.status(errorCode.getStatus()).body(ApiResponse.failure(error));
	}
}
