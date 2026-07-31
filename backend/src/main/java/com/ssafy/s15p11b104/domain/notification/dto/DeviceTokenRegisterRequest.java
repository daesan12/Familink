package com.ssafy.s15p11b104.domain.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record DeviceTokenRegisterRequest(
	@NotBlank @Size(max = 500) String token,
	@NotNull @Pattern(regexp = "ANDROID") String deviceType
) {
}
