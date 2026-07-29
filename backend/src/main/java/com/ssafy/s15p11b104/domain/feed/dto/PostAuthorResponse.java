package com.ssafy.s15p11b104.domain.feed.dto;

import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;

public record PostAuthorResponse(
	Long memberId,
	Long userId,
	String displayName,
	String profileImageUrl,
	GroupRole role) {

	public static PostAuthorResponse from(GroupMember member, String displayName) {
		return new PostAuthorResponse(
			member.getId(),
			member.getUser().getId(),
			displayName,
			member.getUser().getProfileImageUrl(),
			member.getRole());
	}
}
