package com.ssafy.s15p11b104.domain.call.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.ssafy.s15p11b104.domain.call.dto.AiCallDevReportResponse;
import com.ssafy.s15p11b104.domain.call.dto.AiCallDevReportResponse.ReportStatus;
import com.ssafy.s15p11b104.domain.call.service.AiCallDevReportService;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

@ExtendWith(MockitoExtension.class)
class AiCallDevReportControllerTest {

	private static final long CALL_SESSION_ID = 3L;

	@Mock
	private AiCallDevReportService reportService;

	private MockMvc mockMvc;

	@BeforeEach
	void setUp() {
		mockMvc = MockMvcBuilders.standaloneSetup(new AiCallDevReportController(reportService))
			.setControllerAdvice(new CallApiExceptionHandler())
			.build();
	}

	@Test
	void returnsReadyReportForTemporaryWebUi() throws Exception {
		Instant createdAt = Instant.parse("2026-07-30T04:15:04Z");
		when(reportService.get(CALL_SESSION_ID)).thenReturn(new AiCallDevReportResponse(
			CALL_SESSION_ID,
			ReportStatus.READY,
			"가족과 건강 이야기를 나누며 편안하게 통화를 마쳤습니다.",
			EmotionCategory.JOY,
			"기쁨",
			"주말에 가족과 함께 식사하고 싶어 하십니다.",
			createdAt
		));

		mockMvc.perform(get("/ai-call/dev/call-sessions/{callSessionId}/report", CALL_SESSION_ID))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.call_session_id").value(CALL_SESSION_ID))
			.andExpect(jsonPath("$.report_status").value("READY"))
			.andExpect(jsonPath("$.summary").value("가족과 건강 이야기를 나누며 편안하게 통화를 마쳤습니다."))
			.andExpect(jsonPath("$.emotion_category").value("JOY"))
			.andExpect(jsonPath("$.emotion_subcategory").value("기쁨"))
			.andExpect(jsonPath("$.guardian_message").value("주말에 가족과 함께 식사하고 싶어 하십니다."))
			.andExpect(jsonPath("$.created_at").value("2026-07-30T04:15:04Z"));

		verify(reportService).get(CALL_SESSION_ID);
	}
}
