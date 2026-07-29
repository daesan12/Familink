package com.ssafy.s15p11b104.domain.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CommentCreateRequest(
	@NotBlank @Size(max = 50) String content) {
}
