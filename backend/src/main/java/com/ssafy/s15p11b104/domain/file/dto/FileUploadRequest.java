package com.ssafy.s15p11b104.domain.file.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record FileUploadRequest(
	@NotBlank @Size(max = 255) @Pattern(regexp = "[^\\p{Cntrl}/\\\\]+") String fileName,
	@NotBlank @Size(max = 100) String contentType,
	@NotNull @Positive Long sizeBytes) {
}
