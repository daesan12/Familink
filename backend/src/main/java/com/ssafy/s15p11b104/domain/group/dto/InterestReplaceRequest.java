package com.ssafy.s15p11b104.domain.group.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;

public record InterestReplaceRequest(
	@NotNull(message = "\uad00\uc2ec\uc0ac \ubaa9\ub85d\uc740 \ud544\uc218\uc785\ub2c8\ub2e4.")
	List<String> interests) {
}
