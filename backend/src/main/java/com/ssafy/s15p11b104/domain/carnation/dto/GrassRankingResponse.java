package com.ssafy.s15p11b104.domain.carnation.dto;

public record GrassRankingResponse(
	int rank,
	Long memberId,
	String displayName,
	long postCount,
	boolean previousWeekWinner) {
}
