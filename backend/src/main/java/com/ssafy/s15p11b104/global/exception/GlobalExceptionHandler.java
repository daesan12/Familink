package com.ssafy.s15p11b104.global.exception;

import java.util.List;

import org.springframework.context.MessageSourceResolvable;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import com.ssafy.s15p11b104.global.api.ApiErrorResponse;
import com.ssafy.s15p11b104.global.api.ApiErrorResponse.FieldError;

import jakarta.validation.ConstraintViolationException;

/**
 * 계약에 정의된 오류 코드를 공통 실패 봉투로 변환한다.
 *
 * <p>계약에 없는 오류 코드를 만들지 않기 위해 예상하지 못한 예외는 처리하지 않고 프레임워크
 * 기본 처리에 맡긴다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(BusinessException.class)
	ResponseEntity<ApiErrorResponse> handleBusinessException(BusinessException exception) {
		List<FieldError> errors = exception.getField() == null || exception.getDetailMessage() == null
			? List.of()
			: List.of(new FieldError(exception.getField(), exception.getDetailMessage()));
		return toResponse(exception.getErrorCode(), errors);
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ResponseEntity<ApiErrorResponse> handleBodyValidation(MethodArgumentNotValidException exception) {
		List<FieldError> errors = exception.getBindingResult().getFieldErrors().stream()
			.map(error -> new FieldError(error.getField(), error.getDefaultMessage()))
			.toList();
		return toResponse(ErrorCode.INVALID_REQUEST, errors);
	}

	@ExceptionHandler(HandlerMethodValidationException.class)
	ResponseEntity<ApiErrorResponse> handleParameterValidation(HandlerMethodValidationException exception) {
		List<FieldError> errors = exception.getParameterValidationResults().stream()
			.flatMap(result -> result.getResolvableErrors().stream()
				.map(error -> new FieldError(
					result.getMethodParameter().getParameterName(),
					resolveMessage(error))))
			.toList();
		return toResponse(ErrorCode.INVALID_REQUEST, errors);
	}

	@ExceptionHandler({
		ConstraintViolationException.class,
		MissingServletRequestParameterException.class,
		MethodArgumentTypeMismatchException.class,
		HttpMessageNotReadableException.class
	})
	ResponseEntity<ApiErrorResponse> handleInvalidRequest() {
		return toResponse(ErrorCode.INVALID_REQUEST, List.of());
	}

	private String resolveMessage(MessageSourceResolvable error) {
		return error.getDefaultMessage();
	}

	private ResponseEntity<ApiErrorResponse> toResponse(ErrorCode errorCode, List<FieldError> errors) {
		return ResponseEntity.status(errorCode.getStatus()).body(ApiErrorResponse.of(errorCode, errors));
	}
}
