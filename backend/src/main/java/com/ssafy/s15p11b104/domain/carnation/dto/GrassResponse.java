package com.ssafy.s15p11b104.domain.carnation.dto;

import java.time.LocalDate;
import java.util.List;

public record GrassResponse(
	LocalDate weekStart,
	LocalDate weekEnd,
	List<GrassRankingResponse> rankings) {
}
