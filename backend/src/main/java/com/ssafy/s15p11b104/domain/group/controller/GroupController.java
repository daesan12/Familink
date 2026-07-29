package com.ssafy.s15p11b104.domain.group.controller;

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

import com.ssafy.s15p11b104.domain.group.dto.GroupCreateRequest;
import com.ssafy.s15p11b104.domain.group.dto.GroupCreateResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupDeleteRequest;
import com.ssafy.s15p11b104.domain.group.dto.GroupDetailResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupListResponse;
import com.ssafy.s15p11b104.domain.group.dto.GroupUpdateRequest;
import com.ssafy.s15p11b104.domain.group.dto.GroupUpdateResponse;
import com.ssafy.s15p11b104.domain.group.service.GroupService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/groups")
public class GroupController {

	private static final String LIST_MESSAGE = "내 그룹 목록 조회 성공";
	private static final String CREATE_MESSAGE = "그룹 생성 성공";
	private static final String DETAIL_MESSAGE = "그룹 상세 조회 성공";
	private static final String UPDATE_MESSAGE = "그룹 정보 수정 성공";

	private final GroupService groupService;

	public GroupController(GroupService groupService) {
		this.groupService = groupService;
	}

	@GetMapping
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<GroupListResponse> getMyGroups(@AuthenticationPrincipal AuthenticatedUser user) {
		return ApiResponse.success(LIST_MESSAGE, groupService.getMyGroups(user.id()));
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<GroupCreateResponse> create(
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody GroupCreateRequest request) {
		return ApiResponse.success(CREATE_MESSAGE, groupService.create(user.id(), request));
	}

	@GetMapping("/{groupId}")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<GroupDetailResponse> getDetail(
		@PathVariable Long groupId,
		@AuthenticationPrincipal AuthenticatedUser user) {
		return ApiResponse.success(DETAIL_MESSAGE, groupService.getDetail(groupId, user.id()));
	}

	@PatchMapping("/{groupId}")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<GroupUpdateResponse> update(
		@PathVariable Long groupId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody GroupUpdateRequest request) {
		return ApiResponse.success(UPDATE_MESSAGE, groupService.update(groupId, user.id(), request));
	}

	@DeleteMapping("/{groupId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
		@PathVariable Long groupId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody GroupDeleteRequest request) {
		groupService.delete(groupId, user.id(), request);
	}
}
