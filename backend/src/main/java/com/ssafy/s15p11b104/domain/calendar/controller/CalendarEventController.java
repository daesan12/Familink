package com.ssafy.s15p11b104.domain.calendar.controller;

import java.time.LocalDate;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventCreateRequest;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventCreateResponse;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventDetailResponse;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListResponse;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventUpdateRequest;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventUpdateResponse;
import com.ssafy.s15p11b104.domain.calendar.service.CalendarEventService;
import com.ssafy.s15p11b104.global.api.ApiResponse;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;

import jakarta.validation.Valid;

@RestController
@RequestMapping
public class CalendarEventController {

	private static final String LIST_MESSAGE = "일정 목록 조회 성공";
	private static final String DETAIL_MESSAGE = "일정 상세 조회 성공";
	private static final String CREATE_MESSAGE = "일정 등록 성공";
	private static final String UPDATE_MESSAGE = "일정 수정 성공";

	private final CalendarEventService calendarEventService;

	public CalendarEventController(CalendarEventService calendarEventService) {
		this.calendarEventService = calendarEventService;
	}

	@GetMapping("/groups/{groupId}/events")
	public ApiResponse<CalendarEventListResponse> getEvents(
		@PathVariable Long groupId,
		@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
		@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			LIST_MESSAGE,
			calendarEventService.getEvents(groupId, startDate, endDate, authenticatedUser.id()));
	}

	@GetMapping("/events/{eventId}")
	public ApiResponse<CalendarEventDetailResponse> getEvent(
		@PathVariable Long eventId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		return ApiResponse.success(
			DETAIL_MESSAGE,
			calendarEventService.getEvent(eventId, authenticatedUser.id()));
	}

	@PostMapping("/groups/{groupId}/events")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<CalendarEventCreateResponse> create(
		@PathVariable Long groupId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody CalendarEventCreateRequest request) {
		return ApiResponse.success(
			CREATE_MESSAGE,
			calendarEventService.create(groupId, request, authenticatedUser.id()));
	}

	@PatchMapping("/events/{eventId}")
	public ApiResponse<CalendarEventUpdateResponse> update(
		@PathVariable Long eventId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser,
		@Valid @RequestBody CalendarEventUpdateRequest request) {
		return ApiResponse.success(
			UPDATE_MESSAGE,
			calendarEventService.update(eventId, request, authenticatedUser.id()));
	}

	@DeleteMapping("/events/{eventId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
		@PathVariable Long eventId,
		@AuthenticationPrincipal AuthenticatedUser authenticatedUser) {
		calendarEventService.delete(eventId, authenticatedUser.id());
	}
}
