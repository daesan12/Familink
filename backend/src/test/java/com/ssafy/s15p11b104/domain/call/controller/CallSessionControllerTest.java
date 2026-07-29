package com.ssafy.s15p11b104.domain.call.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.ssafy.s15p11b104.domain.call.dto.CallSessionIdResponse;
import com.ssafy.s15p11b104.domain.call.dto.CallTerminationType;
import com.ssafy.s15p11b104.domain.call.service.CallSessionService;

@ExtendWith(MockitoExtension.class)
class CallSessionControllerTest {

	private static final long CALL_SESSION_ID = 1L;

	@Mock
	private CallSessionService callSessionService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new CallSessionController(callSessionService))
			.setControllerAdvice(new CallApiExceptionHandler())
			.build();
	}

	@Test
	void defaultsMissingBodyToUserRequested() throws Exception {
		when(callSessionService.end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED))
			.thenReturn(new CallSessionIdResponse(CALL_SESSION_ID));

		mockMvc.perform(post("/call-sessions/{callSessionId}/end", CALL_SESSION_ID))
			.andExpect(status().isAccepted())
			.andExpect(jsonPath("$.call_session_id").value(CALL_SESSION_ID));

		verify(callSessionService).end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED);
	}

	@Test
	void defaultsMissingTerminationTypeToUserRequested() throws Exception {
		when(callSessionService.end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED))
			.thenReturn(new CallSessionIdResponse(CALL_SESSION_ID));

		mockMvc.perform(post("/call-sessions/{callSessionId}/end", CALL_SESSION_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("{}"))
			.andExpect(status().isAccepted());

		verify(callSessionService).end(CALL_SESSION_ID, CallTerminationType.USER_REQUESTED);
	}

	@Test
	void acceptsConnectionLostTerminationType() throws Exception {
		when(callSessionService.end(CALL_SESSION_ID, CallTerminationType.CONNECTION_LOST))
			.thenReturn(new CallSessionIdResponse(CALL_SESSION_ID));

		mockMvc.perform(post("/call-sessions/{callSessionId}/end", CALL_SESSION_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"termination_type":"CONNECTION_LOST"}
					"""))
			.andExpect(status().isAccepted());

		verify(callSessionService).end(CALL_SESSION_ID, CallTerminationType.CONNECTION_LOST);
	}

	@Test
	void rejectsUnknownTerminationType() throws Exception {
		mockMvc.perform(post("/call-sessions/{callSessionId}/end", CALL_SESSION_ID)
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
					{"termination_type":"UNKNOWN"}
					"""))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));

		verifyNoInteractions(callSessionService);
	}
}
