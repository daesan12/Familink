package com.ssafy.s15p11b104.domain.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record PostMediaRequest(
	@NotBlank @Size(max = 500) String fileUrl,
	@Size(max = 500) String thumbnailUrl,
	@NotNull @PositiveOrZero Integer displayOrder) {
}
