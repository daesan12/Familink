package com.ssafy.s15p11b104.domain.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.support.IntegrationTest;

class DailyReportGenerationIntegrationTest extends IntegrationTest {

	private static final LocalDate REPORT_DATE = LocalDate.of(2026, 7, 30);
	private static final Instant WINDOW_START = Instant.parse("2026-07-29T13:00:00Z");
	private static final Instant WINDOW_END = Instant.parse("2026-07-30T13:00:00Z");
	private static final String INVITE_CODE = "DRP139";
	private static final String LOGIN_ID = "daily-rpt-139";

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private CallReportCallRepository callReportRepository;

	@Autowired
	private DailyReportGenerationService generationService;

	@MockitoBean
	private DailyReportAnalyzer analyzer;

	@BeforeEach
	void setUp() {
		cleanFixture();
	}

	@AfterEach
	void tearDown() {
		cleanFixture();
	}

	@Test
	void queriesCompletedReportsWithStartInclusiveEndExclusiveAndStableOrder() {
		Fixture fixture = insertFixture();
		Long atStart = insertSession(fixture, CallStatus.COMPLETED, WINDOW_START);
		Long inside = insertSession(fixture, CallStatus.COMPLETED, WINDOW_START.plusSeconds(3600));
		insertSession(fixture, CallStatus.COMPLETED, WINDOW_END);
		Long incomplete = insertSession(fixture, CallStatus.INCOMPLETE, WINDOW_START.plusSeconds(7200));
		insertReport(atStart, "시작 경계", null);
		insertReport(inside, "구간 안", "메모");
		insertReport(incomplete, "불완전", null);

		List<Long> callSessionIds = callReportRepository
			.findCompletedInEndedAtRange(CallStatus.COMPLETED, WINDOW_START, WINDOW_END)
			.stream()
			.map(report -> report.getCallSession().getId())
			.toList();

		assertThat(callSessionIds).containsExactly(atStart, inside);
	}

	@Test
	void storesAllDailyReportFieldsWithUtcTimestampColumn() {
		Fixture fixture = insertFixture();
		Long sessionId = insertSession(fixture, CallStatus.COMPLETED, WINDOW_START.plusSeconds(3600));
		insertReport(sessionId, "통화별 요약", "통화별 보호자 메모");
		when(analyzer.analyze(any())).thenReturn(new DailyReportAnalysis(
			"하루 동안 가족 이야기를 나눴습니다.",
			EmotionCategory.JOY,
			"따뜻함",
			"이번 주말에 방문해 주세요."
		));

		generationService.generate(REPORT_DATE);

		Map<String, Object> row = jdbcTemplate.queryForMap("""
			SELECT report_date, summary, emotion_category::text, emotion_subcategory,
				guardian_message, created_at, pg_typeof(created_at)::text AS created_at_type
			FROM daily_reports
			WHERE care_receiver_member_id = ? AND report_date = ?
			""", fixture.memberId(), REPORT_DATE);
		assertThat(row)
			.containsEntry("report_date", java.sql.Date.valueOf(REPORT_DATE))
			.containsEntry("summary", "하루 동안 가족 이야기를 나눴습니다.")
			.containsEntry("emotion_category", "JOY")
			.containsEntry("emotion_subcategory", "따뜻함")
			.containsEntry("guardian_message", "이번 주말에 방문해 주세요.")
			.containsEntry("created_at_type", "timestamp with time zone");
		assertThat(row.get("created_at")).isNotNull();
	}

	@Test
	void repeatedAndConcurrentGenerationCreatesOneDailyReport() throws Exception {
		Fixture fixture = insertFixture();
		Long sessionId = insertSession(fixture, CallStatus.COMPLETED, WINDOW_START.plusSeconds(3600));
		insertReport(sessionId, "동시 실행 대상", null);
		when(analyzer.analyze(any())).thenReturn(new DailyReportAnalysis(
			"동시 실행 하루 요약",
			EmotionCategory.NEUTRAL,
			"차분함",
			null
		));

		ExecutorService executor = Executors.newFixedThreadPool(2);
		CountDownLatch start = new CountDownLatch(1);
		try {
			List<Future<?>> futures = List.of(
				executor.submit(() -> runAfter(start)),
				executor.submit(() -> runAfter(start))
			);
			start.countDown();
			for (Future<?> future : futures) {
				future.get(10, TimeUnit.SECONDS);
			}
		} finally {
			executor.shutdownNow();
		}

		generationService.generate(REPORT_DATE);

		assertThat(jdbcTemplate.queryForObject(
			"SELECT COUNT(*) FROM daily_reports WHERE care_receiver_member_id = ? AND report_date = ?",
			Integer.class,
			fixture.memberId(),
			REPORT_DATE
		)).isEqualTo(1);
		verify(analyzer, atLeastOnce()).analyze(any());
	}

	private void runAfter(CountDownLatch start) {
		try {
			start.await(5, TimeUnit.SECONDS);
			generationService.generate(REPORT_DATE);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw new AssertionError("동시 생성 테스트가 중단됐습니다.", exception);
		}
	}

	private Fixture insertFixture() {
		Long userId = jdbcTemplate.queryForObject("""
			INSERT INTO users (login_id, password_hash, name, birth_date, gender)
			VALUES (?, 'unused', '리포트사용자', DATE '1950-01-01', 'FEMALE')
			RETURNING id
			""", Long.class, LOGIN_ID);
		Long groupId = jdbcTemplate.queryForObject("""
			INSERT INTO family_groups (name, invite_code)
			VALUES ('일일 리포트 가족', ?)
			RETURNING id
			""", Long.class, INVITE_CODE);
		Long memberId = jdbcTemplate.queryForObject("""
			INSERT INTO group_members (group_id, user_id, role, is_manager, joined_at)
			VALUES (?, ?, 'CARE_RECEIVER', FALSE, CURRENT_TIMESTAMP)
			RETURNING id
			""", Long.class, groupId, userId);
		return new Fixture(groupId, memberId);
	}

	private Long insertSession(Fixture fixture, CallStatus status, Instant endedAt) {
		return jdbcTemplate.queryForObject("""
			INSERT INTO call_sessions (
				group_id, care_receiver_member_id, persona_id, status, started_at, ended_at
			)
			VALUES (?, ?, 1, CAST(? AS call_status), ?, ?)
			RETURNING id
			""", Long.class,
			fixture.groupId(),
			fixture.memberId(),
			status.name(),
			Timestamp.from(endedAt.minusSeconds(60)),
			Timestamp.from(endedAt));
	}

	private void insertReport(Long sessionId, String summary, String guardianMessage) {
		jdbcTemplate.update("""
			INSERT INTO call_reports (
				call_session_id, summary, emotion_category, emotion_subcategory, guardian_message
			)
			VALUES (?, ?, 'NEUTRAL', '차분함', ?)
			""", sessionId, summary, guardianMessage);
	}

	private void cleanFixture() {
		jdbcTemplate.update("""
			DELETE FROM daily_reports
			WHERE care_receiver_member_id IN (
				SELECT id FROM group_members WHERE group_id IN (
					SELECT id FROM family_groups WHERE invite_code = ?
				)
			)
			""", INVITE_CODE);
		jdbcTemplate.update("""
			DELETE FROM call_reports
			WHERE call_session_id IN (
				SELECT id FROM call_sessions WHERE group_id IN (
					SELECT id FROM family_groups WHERE invite_code = ?
				)
			)
			""", INVITE_CODE);
		jdbcTemplate.update("""
			DELETE FROM call_sessions
			WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = ?)
			""", INVITE_CODE);
		jdbcTemplate.update("""
			DELETE FROM group_members
			WHERE group_id IN (SELECT id FROM family_groups WHERE invite_code = ?)
			""", INVITE_CODE);
		jdbcTemplate.update("DELETE FROM users WHERE login_id = ?", LOGIN_ID);
		jdbcTemplate.update("DELETE FROM family_groups WHERE invite_code = ?", INVITE_CODE);
	}

	private record Fixture(Long groupId, Long memberId) {
	}
}
