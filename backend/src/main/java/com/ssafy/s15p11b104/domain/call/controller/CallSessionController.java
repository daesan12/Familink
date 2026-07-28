package com.ssafy.s15p11b104.domain.call.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.s15p11b104.domain.call.dto.CallConnectionResultRequest;
import com.ssafy.s15p11b104.domain.call.dto.CallSessionIdResponse;
import com.ssafy.s15p11b104.domain.call.dto.CreateCallSessionRequest;
import com.ssafy.s15p11b104.domain.call.dto.CreateCallSessionResponse;
import com.ssafy.s15p11b104.domain.call.service.CallSessionService;

import jakarta.validation.Valid;

@Validated
@RestController
@RequestMapping("/call-sessions")
public class CallSessionController {

	private final CallSessionService callSessionService;

	public CallSessionController(CallSessionService callSessionService) {
		this.callSessionService = callSessionService;
	}

	@PostMapping
	public ResponseEntity<CreateCallSessionResponse> create(
		@Valid @RequestBody CreateCallSessionRequest request
	) {
		return ResponseEntity.status(HttpStatus.CREATED).body(callSessionService.create(request));
	}

	@PostMapping("/{callSessionId}/connection-result")
	public CallSessionIdResponse recordConnectionResult(
		@PathVariable Long callSessionId,
		@Valid @RequestBody CallConnectionResultRequest request
	) {
		return callSessionService.recordConnectionResult(callSessionId, request);
	}

	@PostMapping("/{callSessionId}/end")
	public ResponseEntity<CallSessionIdResponse> end(@PathVariable Long callSessionId) {
		return ResponseEntity.accepted().body(callSessionService.end(callSessionId));
	}
}
