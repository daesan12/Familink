package com.ssafy.s15p11b104.domain.file.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.file.dto.PresignedUrlRequest;
import com.ssafy.s15p11b104.domain.file.dto.PresignedUrlResponse;
import com.ssafy.s15p11b104.domain.file.service.FileUploadService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/files")
public class FileUploadController {

	private final FileUploadService fileUploadService;

	public FileUploadController(FileUploadService fileUploadService) {
		this.fileUploadService = fileUploadService;
	}

	@PostMapping("/presigned-urls")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<PresignedUrlResponse> issue(
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody PresignedUrlRequest request) {
		return ApiResponse.success("미디어 업로드 URL 발급 성공",
			fileUploadService.issue(request, authenticatedUser.id()));
	}
}
