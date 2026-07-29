package com.ssafy.s15p11b104.domain.feed.dto;

import java.util.List;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PostCreateRequest(
	@NotEmpty List<@NotNull Long> groupIds,
	@NotBlank @Size(max = 140) String content,
	MediaType mediaType,
	@Valid List<@NotNull PostMediaRequest> media) {
}
