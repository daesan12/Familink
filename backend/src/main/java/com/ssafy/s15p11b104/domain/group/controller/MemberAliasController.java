package com.ssafy.s15p11b104.domain.group.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.group.dto.AliasResponse;
import com.ssafy.s15p11b104.domain.group.dto.AliasUpdateRequest;
import com.ssafy.s15p11b104.domain.group.service.MemberAliasService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/groups/{groupId}/members/{targetMemberId}/alias")
public class MemberAliasController {

	private static final String UPDATE_MESSAGE = "구성원 호칭 저장 성공";

	private final MemberAliasService memberAliasService;

	public MemberAliasController(MemberAliasService memberAliasService) {
		this.memberAliasService = memberAliasService;
	}

	@PutMapping
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<AliasResponse> updateAlias(
		@PathVariable Long groupId,
		@PathVariable Long targetMemberId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody AliasUpdateRequest request) {
		return ApiResponse.success(
			UPDATE_MESSAGE,
			memberAliasService.updateAlias(groupId, targetMemberId, user.id(), request));
	}
}
