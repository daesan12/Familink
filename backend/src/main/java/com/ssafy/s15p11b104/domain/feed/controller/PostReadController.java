package com.ssafy.s15p11b104.domain.feed.controller;

import java.time.LocalDate;

import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.feed.dto.PostArchiveResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostDetailResponse;
import com.ssafy.s15p11b104.domain.feed.dto.PostListResponse;
import com.ssafy.s15p11b104.domain.feed.service.PostReadService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

@RestController
@RequestMapping
public class PostReadController {

	private final PostReadService postReadService;

	public PostReadController(PostReadService postReadService) {
		this.postReadService = postReadService;
	}

	@GetMapping("/groups/{groupId}/posts")
	public ApiResponse<PostListResponse> getPosts(
		@PathVariable Long groupId,
		@PageableDefault(size = 20) Pageable pageable,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"게시글 목록 조회 성공",
			postReadService.getPosts(groupId, pageable, authenticatedUser.id()));
	}

	@GetMapping("/posts/{postId}")
	public ApiResponse<PostDetailResponse> getPost(
		@PathVariable Long postId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"게시글 상세 조회 성공",
			postReadService.getPost(postId, authenticatedUser.id()));
	}

	@GetMapping("/groups/{groupId}/archive")
	public ApiResponse<PostArchiveResponse> getArchive(
		@PathVariable Long groupId,
		@RequestParam(required = false) LocalDate date,
		@RequestParam(required = false) String type,
		@RequestParam(required = false) Long memberId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"게시글 보관함 조회 성공",
			postReadService.getArchive(groupId, date, type, memberId, authenticatedUser.id()));
	}
}
