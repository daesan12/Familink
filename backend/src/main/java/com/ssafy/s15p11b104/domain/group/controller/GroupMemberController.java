package com.ssafy.s15p11b104.domain.group.controller;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.group.dto.GroupMemberListResponse;
import com.ssafy.s15p11b104.domain.group.dto.ManagerUpdateRequest;
import com.ssafy.s15p11b104.domain.group.dto.ManagerUpdateResponse;
import com.ssafy.s15p11b104.domain.group.dto.MemberProfileResponse;
import com.ssafy.s15p11b104.domain.group.dto.MemberRoleUpdateRequest;
import com.ssafy.s15p11b104.domain.group.dto.MemberRoleUpdateResponse;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.service.GroupMemberService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/groups/{groupId}")
public class GroupMemberController {

	private static final String LIST_MESSAGE = "그룹 구성원 조회 성공";
	private static final String PROFILE_MESSAGE = "구성원 프로필 조회 성공";
	private static final String ROLE_MESSAGE = "구성원 역할 변경 성공";
	private static final String MANAGER_MESSAGE = "관리자 변경 성공";

	private final GroupMemberService groupMemberService;

	public GroupMemberController(GroupMemberService groupMemberService) {
		this.groupMemberService = groupMemberService;
	}

	@GetMapping("/members")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<GroupMemberListResponse> getMembers(
		@PathVariable Long groupId,
		@RequestParam(required = false) GroupRole role,
		@AuthenticationPrincipal AuthenticatedUser user) {
		return ApiResponse.success(LIST_MESSAGE, groupMemberService.getMembers(groupId, user.id(), role));
	}

	@GetMapping("/members/{memberId}")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<MemberProfileResponse> getMemberProfile(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@AuthenticationPrincipal AuthenticatedUser user) {
		return ApiResponse.success(
			PROFILE_MESSAGE, groupMemberService.getMemberProfile(groupId, memberId, user.id()));
	}

	@PatchMapping("/members/{memberId}/role")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<MemberRoleUpdateResponse> changeRole(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody MemberRoleUpdateRequest request) {
		return ApiResponse.success(
			ROLE_MESSAGE, groupMemberService.changeRole(groupId, memberId, user.id(), request));
	}

	@PatchMapping("/manager")
	@ResponseStatus(HttpStatus.OK)
	public ApiResponse<ManagerUpdateResponse> changeManager(
		@PathVariable Long groupId,
		@AuthenticationPrincipal AuthenticatedUser user,
		@Valid @RequestBody ManagerUpdateRequest request) {
		return ApiResponse.success(
			MANAGER_MESSAGE, groupMemberService.changeManager(groupId, user.id(), request));
	}

	@DeleteMapping("/members/{memberId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void removeMember(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@AuthenticationPrincipal AuthenticatedUser user) {
		groupMemberService.removeMember(groupId, memberId, user.id());
	}
}
