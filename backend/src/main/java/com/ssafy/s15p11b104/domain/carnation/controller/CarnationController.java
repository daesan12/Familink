package com.ssafy.s15p11b104.domain.carnation.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.carnation.dto.CarnationCalendarResponse;
import com.ssafy.s15p11b104.domain.carnation.dto.GrassResponse;
import com.ssafy.s15p11b104.domain.carnation.service.CarnationService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

@RestController
@RequestMapping("/groups")
public class CarnationController {

	private final CarnationService carnationService;

	public CarnationController(CarnationService carnationService) {
		this.carnationService = carnationService;
	}

	@GetMapping("/{groupId}/grass")
	public ApiResponse<GrassResponse> getGrass(
		@PathVariable Long groupId,
		@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
		@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"카네이션 잔디·랭킹 조회 성공",
			carnationService.getGrass(groupId, startDate, endDate, authenticatedUser.id()));
	}

	@GetMapping("/{groupId}/members/{memberId}/carnations")
	public ApiResponse<CarnationCalendarResponse> getCarnations(
		@PathVariable Long groupId,
		@PathVariable Long memberId,
		@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
		@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			"카네이션 달력 조회 성공",
			carnationService.getCarnations(groupId, memberId, startDate, endDate, authenticatedUser.id()));
	}
}
