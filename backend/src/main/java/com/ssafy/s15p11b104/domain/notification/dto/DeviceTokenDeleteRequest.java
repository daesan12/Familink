package com.ssafy.s15p11b104.domain.notification.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DeviceTokenDeleteRequest(
	@NotBlank @Size(max = 500) String token
) {
}
