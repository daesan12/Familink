package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.call.dto.CallTerminationType;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationService;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiClient;
import com.ssafy.s15p11b104.global.ai.gemini.GeminiGenerationRequest;
import com.ssafy.s15p11b104.support.IntegrationTest;

class CallReportGenerationIntegrationTest extends IntegrationTest {

	private static final String INVITE_CODE = "RPT001";
	private static final String LOGIN_ID = "rpt-user";

	@Autowired
	private CallSessionService callSessionService;

	@Autowired
	private CallTranscriptService callTranscriptService;

	@Autowired
	private CallReportGenerationService callReportGenerationService;

	@Autowired
	private CallReportCallRepository callReportRepository;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@MockitoBean
	private CallActorResolver callActorResolver;

	@MockitoBean
	private SidebandSessionManager sidebandSessionManager;

	@MockitoBean
	private OpenAiRealtimeGateway realtimeGateway;

	@MockitoBean
	private GeminiClient geminiClient;

	@MockitoBean
	private CallTeardownExecutor callTeardownExecutor;

	@BeforeEach
	void setUp() {
		cleanFixture();
		// 종료 응답 이후의 뒷정리를 호출 스레드에서 실행해 전사 마감 결과를 그대로 검증한다.
		doAnswer(invocation -> {
			invocation.getArgument(0, Runnable.class).run();
			return null;
		}).when(callTeardownExecutor).execute(any());
	}

	@AfterEach
	void tearDown() {
		cleanFixture();
	}

	@Test
	void createsOneReportFromActualSidebandTranscriptsAfterNormalCallEnd() {
		Fixture fixture = insertFixture(CallStatus.IN_PROGRESS);
		when(callActorResolver.resolve()).thenReturn(new CallActor(fixture.memberId()));
		SidebandSessionManager.ClosingSideband closingSideband =
			mock(SidebandSessionManager.ClosingSideband.class);
		when(closingSideband.callId()).thenReturn("call_report_test");
		when(closingSideband.finishClose()).thenReturn(true);
		when(sidebandSessionManager.claimClose(fixture.callSessionId())).thenReturn(closingSideband);
		when(geminiClient.generate(any())).thenReturn("""
			{
			  "summary":"시장에 다녀온 이야기와 가족에 대한 그리움을 나눴습니다.",
			  "emotionCategory":"JOY",
			  "emotionSubcategory":"반가움",
			  "guardianMessage":"주말에 가족이 방문하면 좋겠다고 말씀하셨어요."
			}
			""");
		SidebandTranscriptHandler handler = new SidebandTranscriptHandler(
			fixture.callSessionId(),
			objectMapper,
			callTranscriptService
		);
		handler.acceptText(itemAdded("user-1", "user"), true);
		handler.acceptText(itemAdded("assistant-1", "assistant"), true);
		handler.acceptText(assistantTranscriptDone("assistant-1", "시장에서는 무엇을 사셨어요?"), true);
		handler.acceptText(userTranscriptCompleted("user-1", "오늘 시장에 다녀왔어요."), true);

		callSessionService.end(fixture.callSessionId(), CallTerminationType.USER_REQUESTED);
		awaitReport(fixture.callSessionId());
		callSessionService.end(fixture.callSessionId(), CallTerminationType.USER_REQUESTED);

		assertThat(jdbcTemplate.queryForObject(
			"SELECT status::text FROM call_sessions WHERE id = ?",
			String.class,
			fixture.callSessionId()
		)).isEqualTo("COMPLETED");
		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT transcript_integrity_status::text AS integrity_status,
					transcript_finalized_at IS NOT NULL AS finalized
				FROM call_sessions
				WHERE id = ?
				""",
			fixture.callSessionId()
		)).containsEntry("integrity_status", "COMPLETE")
			.containsEntry("finalized", true);
		assertThat(jdbcTemplate.query(
			"""
				SELECT status::text
				FROM call_transcript_events
				WHERE call_session_id = ?
				ORDER BY sequence
				""",
			(resultSet, rowNumber) -> resultSet.getString(1),
			fixture.callSessionId()
		)).containsExactly("APPLIED", "APPLIED");
		assertThat(jdbcTemplate.query(
			"""
				SELECT speaker::text, content
				FROM call_transcripts
				WHERE call_session_id = ?
				ORDER BY sequence
				""",
			(resultSet, rowNumber) -> resultSet.getString(1) + ":" + resultSet.getString(2),
			fixture.callSessionId()
		)).containsExactly(
			"USER:오늘 시장에 다녀왔어요.",
			"ASSISTANT:시장에서는 무엇을 사셨어요?"
		);
		assertThat(jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM call_reports WHERE call_session_id = ?",
			Integer.class,
			fixture.callSessionId()
		)).isEqualTo(1);
		assertThat(callReportRepository.findCompletedInEndedAtRange(
			CallStatus.COMPLETED,
			Instant.now().minus(Duration.ofHours(1)),
			Instant.now().plus(Duration.ofHours(1))
		)).anyMatch(report -> report.getCallSession().getId().equals(fixture.callSessionId()));
		assertThat(jdbcTemplate.queryForObject(
			"SELECT status::text FROM call_report_generation_requests WHERE call_session_id = ?",
			String.class,
			fixture.callSessionId()
		)).isEqualTo("DONE");
		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT summary, emotion_category::text, emotion_subcategory, guardian_message
				FROM call_reports
				WHERE call_session_id = ?
				""",
			fixture.callSessionId()
		)).containsEntry(
			"summary",
			"시장에 다녀온 이야기와 가족에 대한 그리움을 나눴습니다."
		).containsEntry(
			"emotion_category",
			"JOY"
		).containsEntry(
			"emotion_subcategory",
			"반가움"
		).containsEntry(
			"guardian_message",
			"주말에 가족이 방문하면 좋겠다고 말씀하셨어요."
		);
		ArgumentCaptor<GeminiGenerationRequest> requestCaptor =
			ArgumentCaptor.forClass(GeminiGenerationRequest.class);
		verify(geminiClient, times(1)).generate(requestCaptor.capture());
		assertThat(requestCaptor.getValue().prompt().indexOf("[1][USER]"))
			.isLessThan(requestCaptor.getValue().prompt().indexOf("[2][ASSISTANT]"));
		verify(realtimeGateway, times(2)).hangUp("call_report_test");
		verify(closingSideband, times(2)).finishClose();
	}

	@Test
	void skipsIneligibleStatusesAndCompletedCallWithoutTranscript() {
		List<CallStatus> ineligibleStatuses = List.of(
			CallStatus.CONNECTING,
			CallStatus.IN_PROGRESS,
			CallStatus.INCOMPLETE,
			CallStatus.CANCELLED,
			CallStatus.FAILED
		);
		for (CallStatus status : ineligibleStatuses) {
			Fixture fixture = insertFixture(status);
			callReportGenerationService.generate(fixture.callSessionId());
		}
		Fixture completedWithoutTranscript = insertFixture(CallStatus.COMPLETED);

		callReportGenerationService.generate(completedWithoutTranscript.callSessionId());

		assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM call_reports", Integer.class)).isZero();
		verifyNoInteractions(geminiClient);
	}

	@Test
	void storesNothingWhenGeminiFails() {
		Fixture fixture = insertFixture(CallStatus.COMPLETED);
		callTranscriptService.saveIfAbsent(
			fixture.callSessionId(),
			com.ssafy.s15p11b104.domain.call.entity.SpeakerType.USER,
			"안녕하세요.",
			1,
			"failure-user-1"
		);
		assertThat(callTranscriptService.finalizeSession(fixture.callSessionId(), true)).isTrue();
		when(geminiClient.generate(any())).thenThrow(new IllegalStateException("upstream test-secret"));

		callReportGenerationService.generate(fixture.callSessionId());

		assertThat(jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM call_reports WHERE call_session_id = ?",
			Integer.class,
			fixture.callSessionId()
		)).isZero();
		assertThat(jdbcTemplate.queryForMap(
			"""
				SELECT status::text AS status, last_failure_code,
					last_failed_at IS NOT NULL AS failed_at_recorded
				FROM call_report_generation_requests
				WHERE call_session_id = ?
				""",
			fixture.callSessionId()
		)).containsEntry("status", "GEMINI_FAILED")
			.containsEntry("last_failure_code", "ANALYSIS_FAILED")
			.containsEntry("failed_at_recorded", true);
	}

	private Fixture insertFixture(CallStatus status) {
		Long groupId = jdbcTemplate.queryForObject("""
			INSERT INTO family_groups (name, invite_code)
			VALUES ('리포트 가족', ?)
			ON CONFLICT (invite_code) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
			""", Long.class, inviteCodeFor(status));
		Long userId = jdbcTemplate.queryForObject("""
			INSERT INTO users (login_id, password_hash, name, birth_date, gender)
			VALUES (?, 'unused', '리포트 사용자', DATE '1950-01-01', 'FEMALE')
			ON CONFLICT (login_id) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
			""", Long.class, loginIdFor(status));
		Long memberId = jdbcTemplate.queryForObject("""
			INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at)
			VALUES (?, ?, 'CARE_RECEIVER', FALSE, CURRENT_TIMESTAMP)
			ON CONFLICT (group_id, user_id) DO UPDATE SET left_at = NULL
			RETURNING id
			""", Long.class, groupId, userId);
		Long callSessionId = jdbcTemplate.queryForObject("""
			INSERT INTO call_sessions (
				group_id, care_receiver_member_id, persona_id, status,
				started_at, ended_at, lease_expires_at
			)
			VALUES (?, ?, 1, CAST(? AS call_status),
				CASE WHEN ? IN ('IN_PROGRESS', 'COMPLETED', 'INCOMPLETE') THEN CURRENT_TIMESTAMP ELSE NULL END,
				CASE WHEN ? IN ('COMPLETED', 'INCOMPLETE', 'CANCELLED', 'FAILED') THEN CURRENT_TIMESTAMP ELSE NULL END,
				CASE WHEN ? IN ('CONNECTING', 'IN_PROGRESS')
					THEN CURRENT_TIMESTAMP + INTERVAL '90 seconds' ELSE NULL END)
			RETURNING id
			""", Long.class, groupId, memberId, status.name(), status.name(), status.name(), status.name());
		return new Fixture(memberId, callSessionId);
	}

	private String inviteCodeFor(CallStatus status) {
		return INVITE_CODE.substring(0, 3) + String.format("%03d", status.ordinal());
	}

	private String loginIdFor(CallStatus status) {
		return LOGIN_ID + "-" + status.ordinal();
	}

	private void awaitReport(Long callSessionId) {
		long deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos();
		while (System.nanoTime() < deadline) {
			Integer count = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM call_reports WHERE call_session_id = ?",
				Integer.class,
				callSessionId
			);
			if (count != null && count == 1) {
				return;
			}
			try {
				Thread.sleep(25);
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new AssertionError("통화 리포트 생성을 기다리던 중 중단됐습니다.", exception);
			}
		}
		throw new AssertionError("제한 시간 안에 통화 리포트가 생성되지 않았습니다.");
	}

	private void cleanFixture() {
		jdbcTemplate.update("""
			DELETE FROM call_reports
			WHERE call_session_id IN (
				SELECT session.id
				FROM call_sessions session
				JOIN group_members member ON member.id = session.care_receiver_member_id
				JOIN users user_account ON user_account.id = member.user_id
				WHERE user_account.login_id LIKE ?
			)
			""", LOGIN_ID + "%");
		jdbcTemplate.update("""
			DELETE FROM call_transcripts
			WHERE call_session_id IN (
				SELECT session.id
				FROM call_sessions session
				JOIN group_members member ON member.id = session.care_receiver_member_id
				JOIN users user_account ON user_account.id = member.user_id
				WHERE user_account.login_id LIKE ?
			)
			""", LOGIN_ID + "%");
		jdbcTemplate.update("""
			DELETE FROM call_sessions
			WHERE care_receiver_member_id IN (
				SELECT member.id
				FROM group_members member
				JOIN users user_account ON user_account.id = member.user_id
				WHERE user_account.login_id LIKE ?
			)
			""", LOGIN_ID + "%");
		jdbcTemplate.update("""
			DELETE FROM group_members
			WHERE user_id IN (SELECT id FROM users WHERE login_id LIKE ?)
			""", LOGIN_ID + "%");
		jdbcTemplate.update("DELETE FROM users WHERE login_id LIKE ?", LOGIN_ID + "%");
		jdbcTemplate.update("DELETE FROM family_groups WHERE invite_code LIKE 'RPT%'");
	}

	private String itemAdded(String itemId, String role) {
		return """
			{
			  "type":"conversation.item.added",
			  "item":{"id":"%s","type":"message","role":"%s"}
			}
			""".formatted(itemId, role);
	}

	private String userTranscriptCompleted(String itemId, String transcript) {
		return completedTranscript(
			"conversation.item.input_audio_transcription.completed",
			"event-user",
			itemId,
			transcript
		);
	}

	private String assistantTranscriptDone(String itemId, String transcript) {
		return completedTranscript(
			"response.output_audio_transcript.done",
			"event-assistant",
			itemId,
			transcript
		);
	}

	private String completedTranscript(String type, String eventId, String itemId, String transcript) {
		return """
			{
			  "type":"%s",
			  "event_id":"%s",
			  "item_id":"%s",
			  "transcript":"%s"
			}
			""".formatted(type, eventId, itemId, transcript);
	}

	private record Fixture(Long memberId, Long callSessionId) {
	}
}
