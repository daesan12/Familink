package com.ssafy.s15p11b104.global.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.global.api.ApiErrorResponse;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 인증·인가 실패를 공통 실패 봉투로 응답한다.
 *
 * <p>Spring Security가 처리하는 거부는 컨트롤러에 도달하지 않아
 * {@code GlobalExceptionHandler}가 관여할 수 없으므로 여기서 같은 형식으로 직접 작성한다.
 */
@Component
public class SecurityErrorResponder implements AuthenticationEntryPoint, AccessDeniedHandler {

	private final ObjectMapper objectMapper;

	SecurityErrorResponder(ObjectMapper objectMapper) {
		this.objectMapper = objectMapper;
	}

	@Override
	public void commence(
		HttpServletRequest request,
		HttpServletResponse response,
		AuthenticationException authenticationException
	) throws IOException {
		write(response, ErrorCode.UNAUTHORIZED);
	}

	@Override
	public void handle(
		HttpServletRequest request,
		HttpServletResponse response,
		AccessDeniedException accessDeniedException
	) throws IOException {
		write(response, ErrorCode.FORBIDDEN);
	}

	private void write(HttpServletResponse response, ErrorCode errorCode) throws IOException {
		response.setStatus(errorCode.getStatus().value());
		response.setContentType(MediaType.APPLICATION_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of(errorCode, List.of()));
	}
}
