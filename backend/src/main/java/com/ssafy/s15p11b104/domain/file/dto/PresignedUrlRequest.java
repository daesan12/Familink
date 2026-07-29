package com.ssafy.s15p11b104.domain.file.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PresignedUrlRequest(
	@NotBlank
	@Size(max = 50)
	@Pattern(regexp = "[A-Za-z0-9_-]+")
	String purpose,
	@NotEmpty List<@Valid FileUploadRequest> files) {
}
