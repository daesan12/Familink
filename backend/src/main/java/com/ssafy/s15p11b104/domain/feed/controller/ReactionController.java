package com.ssafy.s15p11b104.domain.feed.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.feed.dto.ReactionRequest;
import com.ssafy.s15p11b104.domain.feed.dto.ReactionResponse;
import com.ssafy.s15p11b104.domain.feed.service.ReactionService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping
public class ReactionController {

	private final ReactionService reactionService;

	public ReactionController(ReactionService reactionService) {
		this.reactionService = reactionService;
	}

	@PutMapping("/posts/{postId}/reaction")
	public ApiResponse<ReactionResponse> react(
		@PathVariable Long postId,
		@Valid @RequestBody ReactionRequest request,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"게시글 반응 처리 성공",
			reactionService.react(postId, request, authenticatedUser.id()));
	}
}
