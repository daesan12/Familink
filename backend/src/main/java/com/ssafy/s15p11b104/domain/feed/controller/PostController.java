package com.ssafy.s15p11b104.domain.feed.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.feed.dto.PostCreateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.PostCreateResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostUpdateRequest;
import com.ssafy.s15p11b104.domain.feed.dto.PostUpdateResponse;
import com.ssafy.s15p11b104.domain.feed.service.PostService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/posts")
public class PostController {

	private static final String CREATE_MESSAGE = "게시글 작성 성공";
	private static final String UPDATE_MESSAGE = "게시글 수정 성공";

	private final PostService postService;

	public PostController(PostService postService) {
		this.postService = postService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<PostCreateResponse> create(
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody PostCreateRequest request) {
		return ApiResponse.success(CREATE_MESSAGE, postService.create(request, authenticatedUser.id()));
	}

	@PatchMapping("/{postId}")
	public ApiResponse<PostUpdateResponse> update(
		@PathVariable Long postId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody PostUpdateRequest request) {
		return ApiResponse.success(UPDATE_MESSAGE, postService.update(postId, request, authenticatedUser.id()));
	}

	@DeleteMapping("/{postId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
		@PathVariable Long postId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		postService.delete(postId, authenticatedUser.id());
	}
}
