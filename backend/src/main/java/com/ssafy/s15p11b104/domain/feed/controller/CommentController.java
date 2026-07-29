package com.ssafy.s15p11b104.domain.feed.controller;

import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.feed.dto.CommentCreateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.CommentCreateResponse;
import com.ssafy.s15p11b104.domain.feed.dto.CommentListResponse;
import com.ssafy.s15p11b104.domain.feed.dto.CommentUpdateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.CommentUpdateResponse;
import com.ssafy.s15p11b104.domain.feed.service.CommentService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping
public class CommentController {

	private final CommentService commentService;

	public CommentController(CommentService commentService) {
		this.commentService = commentService;
	}

	@GetMapping("/posts/{postId}/comments")
	public ApiResponse<CommentListResponse> getComments(
		@PathVariable Long postId,
		@PageableDefault(size = 20) Pageable pageable,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"댓글 목록 조회 성공",
			commentService.getComments(postId, pageable, authenticatedUser.id()));
	}

	@PostMapping("/posts/{postId}/comments")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<CommentCreateResponse> create(
		@PathVariable Long postId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody CommentCreateRequest request) {
		return ApiResponse.success(
			"댓글 작성 성공",
			commentService.create(postId, request, authenticatedUser.id()));
	}

	@PatchMapping("/comments/{commentId}")
	public ApiResponse<CommentUpdateResponse> update(
		@PathVariable Long commentId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody CommentUpdateRequest request) {
		return ApiResponse.success(
			"댓글 수정 성공",
			commentService.update(commentId, request, authenticatedUser.id()));
	}

	@DeleteMapping("/comments/{commentId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
		@PathVariable Long commentId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		commentService.delete(commentId, authenticatedUser.id());
	}
}
