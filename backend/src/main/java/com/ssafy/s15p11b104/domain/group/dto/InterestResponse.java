package com.ssafy.s15p11b104.domain.group.dto;

import java.util.List;

public record InterestResponse(Long memberId, List<String> interests) {
}
