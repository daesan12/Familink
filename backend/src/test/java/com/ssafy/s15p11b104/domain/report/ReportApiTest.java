package com.ssafy.s15p11b104.domain.report;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;
import com.ssafy.s15p11b104.global.security.AuthenticatedUser;
import com.ssafy.s15p11b104.support.IntegrationTest;

import jakarta.persistence.EntityManager;

/**
 * 리포트 달력·일일·건별 통화 리포트 조회를 검증한다.
 *
 * <p>{@code API-REPORTS-001}~{@code 003}의 응답 필드와 권한 규칙을 고정한다. 일일 리포트의 통화
 * 목록은 {@code report_date=D}가 {@code [D-1 22:00, D 22:00)} {@code Asia/Seoul} 구간을 뜻하므로
 * 그 경계값으로 포함·제외를 단정한다.
 */
@AutoConfigureMockMvc
@Transactional
class ReportApiTest extends IntegrationTest {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");
	private static final LocalDate REPORT_DATE = LocalDate.of(2026, 7, 15);
	private static final long UNKNOWN_ID = 999_999L;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private EntityManager entityManager;

	@Autowired
	private UserRepository userRepository;

	@Autowired
	private FamilyGroupRepository familyGroupRepository;

	@Autowired
	private GroupMemberRepository groupMemberRepository;

	@Autowired
	private DailyReportRepository dailyReportRepository;

	@Autowired
	private CallSessionRepository callSessionRepository;

	@Autowired
	private CallReportCallRepository callReportRepository;

	private User guardianUser;
	private User careReceiverUser;
	private User leftGuardianUser;
	private User otherGroupGuardianUser;
	private User outsiderUser;
	private FamilyGroup group;
	private GroupMember guardianMember;
	private GroupMember careReceiverMember;
	private GroupMember otherCareReceiverMember;
	private GroupMember leftGuardianMember;
	private GroupMember otherGroupCareReceiverMember;

	@BeforeEach
	void setUp() {
		entityManager.createNativeQuery("DELETE FROM notifications").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM device_tokens").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM notification_settings").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM call_reports").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM call_transcripts").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM call_sessions").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM daily_reports").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_interests").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM member_aliases").executeUpdate();
		entityManager.createNativeQuery("DELETE FROM carnations").executeUpdate();
		groupMemberRepository.deleteAll();
		familyGroupRepository.deleteAll();
		userRepository.deleteAll();
		entityManager.flush();

		guardianUser = userRepository.save(user("rep_guardian", "보호자"));
		careReceiverUser = userRepository.save(user("rep_receiver", "피보호자"));
		User otherCareReceiverUser = userRepository.save(user("rep_receiver2", "다른 피보호자"));
		leftGuardianUser = userRepository.save(user("rep_left", "탈퇴 보호자"));
		otherGroupGuardianUser = userRepository.save(user("rep_other", "타그룹 보호자"));
		outsiderUser = userRepository.save(user("rep_outsider", "외부인"));
		group = familyGroupRepository.save(new FamilyGroup("우리가족", "REP123"));
		FamilyGroup otherGroup = familyGroupRepository.save(new FamilyGroup("옆집가족", "REP456"));
		entityManager.flush();

		guardianMember = groupMemberRepository.save(
			new GroupMember(group, guardianUser, GroupRole.GUARDIAN, true, Instant.now()));
		careReceiverMember = groupMemberRepository.save(
			new GroupMember(group, careReceiverUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		otherCareReceiverMember = groupMemberRepository.save(
			new GroupMember(group, otherCareReceiverUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		leftGuardianMember = groupMemberRepository.save(
			new GroupMember(group, leftGuardianUser, GroupRole.GUARDIAN, false, Instant.now()));
		leftGuardianMember.leave(Instant.now());
		groupMemberRepository.save(
			new GroupMember(otherGroup, otherGroupGuardianUser, GroupRole.GUARDIAN, true, Instant.now()));
		otherGroupCareReceiverMember = groupMemberRepository.save(new GroupMember(
			otherGroup, outsiderUser, GroupRole.CARE_RECEIVER, false, Instant.now()));
		entityManager.flush();
		entityManager.clear();
	}

	// --- 리포트 달력 (API-REPORTS-001) ---

	@Test
	void calendarReturnsOnlyDatesThatHaveDailyReport() throws Exception {
		persistDailyReport(LocalDate.of(2026, 7, 3));
		persistDailyReport(LocalDate.of(2026, 7, 20));
		persistDailyReport(LocalDate.of(2026, 8, 1));

		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), careReceiverMember.getId())
				.param("year", "2026")
				.param("month", "7")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.yearMonth").value("2026-07"))
			.andExpect(jsonPath("$.data.reportDates.length()").value(2))
			.andExpect(jsonPath("$.data.reportDates[0]").value("2026-07-03"))
			.andExpect(jsonPath("$.data.reportDates[1]").value("2026-07-20"))
			.andExpect(jsonPath("$.data.latestReportDate").value("2026-08-01"));
	}

	@Test
	void calendarReturnsEmptyListWhenNoReportExists() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), careReceiverMember.getId())
				.param("year", "2026")
				.param("month", "7")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.reportDates.length()").value(0))
			.andExpect(jsonPath("$.data.latestReportDate").value(nullValue()));
	}

	@Test
	void calendarRejectsMonthOutOfRange() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), careReceiverMember.getId())
				.param("year", "2026")
				.param("month", "13")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	void calendarRejectsNonNumericMonth() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), careReceiverMember.getId())
				.param("year", "2026")
				.param("month", "july")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	// --- 일일 리포트 (API-REPORTS-002) ---

	@Test
	void dailyReportReturnsEveryContractFieldWithCalls() throws Exception {
		persistDailyReport(REPORT_DATE);
		Long withReport = persistCompletedCall(businessTime(REPORT_DATE, 10, 0));
		persistCallReport(withReport);
		Long withoutReport = persistCompletedCall(businessTime(REPORT_DATE, 12, 0));

		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.date").value("2026-07-15"))
			.andExpect(jsonPath("$.data.dailyReport.id").isNumber())
			.andExpect(jsonPath("$.data.dailyReport.summary").value("하루 요약"))
			.andExpect(jsonPath("$.data.dailyReport.emotionCategory").value("JOY"))
			.andExpect(jsonPath("$.data.dailyReport.emotionSubcategory").value("뿌듯함"))
			.andExpect(jsonPath("$.data.dailyReport.guardianMessageSummary").value("오늘은 기분이 좋으셨어요."))
			.andExpect(jsonPath("$.data.calls.length()").value(2))
			.andExpect(jsonPath("$.data.calls[0].callSessionId").value(withReport))
			.andExpect(jsonPath("$.data.calls[0].reportAvailable").value(true))
			.andExpect(jsonPath("$.data.calls[0].startedAt").isNotEmpty())
			.andExpect(jsonPath("$.data.calls[1].callSessionId").value(withoutReport))
			.andExpect(jsonPath("$.data.calls[1].reportAvailable").value(false));
	}

	@Test
	void dailyReportOmitsGuardianMessageWhenAbsent() throws Exception {
		dailyReportRepository.save(new DailyReport(
			familyGroupRepository.findById(group.getId()).orElseThrow(),
			groupMemberRepository.findById(careReceiverMember.getId()).orElseThrow(),
			REPORT_DATE,
			"하루 요약",
			EmotionCategory.NEUTRAL,
			"차분함"));
		entityManager.flush();
		entityManager.clear();

		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.dailyReport.guardianMessageSummary").value(nullValue()));
	}

	/**
	 * 구간에 통화가 없으면 일일 리포트를 만들지 않으므로 빈 상태를 200으로 응답한다.
	 */
	@Test
	void dailyReportReturnsEmptyStateWhenReportMissing() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.success").value(true))
			.andExpect(jsonPath("$.data.dailyReport").value(nullValue()))
			.andExpect(jsonPath("$.data.calls.length()").value(0));
	}

	@Test
	void dailyReportExcludesCallsThatDidNotCompleteNormally() throws Exception {
		persistCancelledCall(businessTime(REPORT_DATE, 9, 0));
		persistFailedCall(businessTime(REPORT_DATE, 10, 0));
		persistIncompleteCall(businessTime(REPORT_DATE, 11, 0));
		Long completed = persistCompletedCall(businessTime(REPORT_DATE, 12, 0));

		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.calls.length()").value(1))
			.andExpect(jsonPath("$.data.calls[0].callSessionId").value(completed));
	}

	/**
	 * {@code report_date=D}의 구간은 전날 22:00을 포함하고 당일 22:00을 제외한다.
	 */
	@Test
	void dailyReportUsesBusinessDayWindowBoundaries() throws Exception {
		Long includedAtWindowStart = persistCompletedCall(businessTime(REPORT_DATE.minusDays(1), 22, 0));
		persistCompletedCall(businessTime(REPORT_DATE.minusDays(1), 21, 59));
		persistCompletedCall(businessTime(REPORT_DATE, 22, 0));

		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.calls.length()").value(1))
			.andExpect(jsonPath("$.data.calls[0].callSessionId").value(includedAtWindowStart));
	}

	@Test
	void dailyReportRejectsMalformedDate() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), "2026-13-40")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	// --- 피보호자 스코프 ---

	/**
	 * 같은 그룹에 피보호자가 여러 명이면 요청한 피보호자의 리포트만 응답해야 한다.
	 *
	 * <p>권한 검사는 그룹 단위로 통과하므로, 조회 쿼리가 피보호자 조건을 잃으면 다른 피보호자의
	 * 리포트가 섞여 들어간다.
	 */
	@Test
	void calendarIsScopedToRequestedCareReceiver() throws Exception {
		persistDailyReportFor(careReceiverMember.getId(), LocalDate.of(2026, 7, 3));
		persistDailyReportFor(otherCareReceiverMember.getId(), LocalDate.of(2026, 7, 10));

		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), careReceiverMember.getId())
				.param("year", "2026")
				.param("month", "7")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.reportDates.length()").value(1))
			.andExpect(jsonPath("$.data.reportDates[0]").value("2026-07-03"))
			.andExpect(jsonPath("$.data.latestReportDate").value("2026-07-03"));
	}

	@Test
	void dailyReportCallsAreScopedToRequestedCareReceiver() throws Exception {
		Long ownCall = persistCompletedCallFor(
			careReceiverMember.getId(), businessTime(REPORT_DATE, 10, 0));
		persistCompletedCallFor(otherCareReceiverMember.getId(), businessTime(REPORT_DATE, 11, 0));

		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), careReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.calls.length()").value(1))
			.andExpect(jsonPath("$.data.calls[0].callSessionId").value(ownCall));
	}

	// --- 건별 통화 리포트 (API-REPORTS-003) ---

	@Test
	void callReportReturnsContractFieldsWithoutEmotion() throws Exception {
		Long callSessionId = persistCompletedCall(businessTime(REPORT_DATE, 10, 0));
		persistCallReport(callSessionId);

		mockMvc.perform(get("/call-sessions/{callSessionId}/report", callSessionId)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.data.callSessionId").value(callSessionId))
			.andExpect(jsonPath("$.data.summary").value("통화 요약"))
			.andExpect(jsonPath("$.data.guardianMessage").value("약을 잘 드셨어요."))
			.andExpect(jsonPath("$.data.createdAt").isNotEmpty())
			.andExpect(jsonPath("$.data.emotionCategory").doesNotExist())
			.andExpect(jsonPath("$.data.emotionSubcategory").doesNotExist());
	}

	@Test
	void callReportReportsNotReadyBeforeGeneration() throws Exception {
		Long callSessionId = persistCompletedCall(businessTime(REPORT_DATE, 10, 0));

		mockMvc.perform(get("/call-sessions/{callSessionId}/report", callSessionId)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isNotFound())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("CALL_REPORT_NOT_READY"));
	}

	// --- 권한 ---

	@Test
	void careReceiverCannotReadOwnReports() throws Exception {
		persistDailyReport(REPORT_DATE);

		expectForbiddenOnEveryEndpoint(careReceiverUser.getId(), careReceiverMember.getId());
	}

	@Test
	void leftGuardianCannotReadReports() throws Exception {
		expectForbiddenOnEveryEndpoint(leftGuardianUser.getId(), careReceiverMember.getId());
	}

	@Test
	void guardianOfAnotherGroupCannotReadReports() throws Exception {
		expectForbiddenOnEveryEndpoint(otherGroupGuardianUser.getId(), careReceiverMember.getId());
	}

	@Test
	void guardianCannotReadReportsOfAnotherGuardian() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), guardianMember.getId())
				.param("year", "2026")
				.param("month", "7")
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void guardianCannotReadReportsOfMemberInAnotherGroup() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), otherGroupCareReceiverMember.getId(), REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	/**
	 * 계약에 404가 없으므로 존재하지 않는 대상도 권한 부족과 같게 응답해 존재 여부를 노출하지 않는다.
	 */
	@Test
	void unknownTargetIsRejectedAsForbidden() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), UNKNOWN_ID, REPORT_DATE)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isForbidden());

		mockMvc.perform(get("/call-sessions/{callSessionId}/report", UNKNOWN_ID)
				.with(authenticatedAs(guardianUser.getId())))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	@Test
	void unauthenticatedRequestIsRejected() throws Exception {
		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), careReceiverMember.getId())
				.param("year", "2026")
				.param("month", "7"))
			.andExpect(status().isUnauthorized());
	}

	// --- 픽스처 ---

	private void expectForbiddenOnEveryEndpoint(Long requesterUserId, Long targetMemberId) throws Exception {
		Long callSessionId = persistCompletedCall(businessTime(REPORT_DATE, 10, 0));
		persistCallReport(callSessionId);

		mockMvc.perform(get("/groups/{groupId}/care-receivers/{memberId}/reports/calendar",
				group.getId(), targetMemberId)
				.param("year", "2026")
				.param("month", "7")
				.with(authenticatedAs(requesterUserId)))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(get("/groups/{groupId}/members/{memberId}/reports/daily/{reportDate}",
				group.getId(), targetMemberId, REPORT_DATE)
				.with(authenticatedAs(requesterUserId)))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));

		mockMvc.perform(get("/call-sessions/{callSessionId}/report", callSessionId)
				.with(authenticatedAs(requesterUserId)))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.code").value("FORBIDDEN"));
	}

	private Instant businessTime(LocalDate date, int hour, int minute) {
		return date.atTime(LocalTime.of(hour, minute)).atZone(BUSINESS_ZONE).toInstant();
	}

	private void persistDailyReport(LocalDate reportDate) {
		persistDailyReportFor(careReceiverMember.getId(), reportDate);
	}

	private void persistDailyReportFor(Long careReceiverMemberId, LocalDate reportDate) {
		dailyReportRepository.save(new DailyReport(
			familyGroupRepository.findById(group.getId()).orElseThrow(),
			groupMemberRepository.findById(careReceiverMemberId).orElseThrow(),
			reportDate,
			"하루 요약",
			EmotionCategory.JOY,
			"뿌듯함",
			"오늘은 기분이 좋으셨어요."));
		entityManager.flush();
		entityManager.clear();
	}

	/**
	 * 정상 종료된 통화를 만든다. 상태 전이 메서드를 거쳐야 시작·종료 시각이 채워진다.
	 */
	private Long persistCompletedCall(Instant endedAt) {
		return persistCompletedCallFor(careReceiverMember.getId(), endedAt);
	}

	private Long persistCompletedCallFor(Long careReceiverMemberId, Instant endedAt) {
		CallSession session = newSessionFor(careReceiverMemberId);
		session.markConnected(endedAt.minusSeconds(300));
		session.endByUser(endedAt);
		return saveSession(session);
	}

	private void persistCancelledCall(Instant endedAt) {
		CallSession session = newSession();
		session.endByUser(endedAt);
		saveSession(session);
	}

	private void persistFailedCall(Instant endedAt) {
		CallSession session = newSession();
		session.markConnectionFailed(endedAt);
		saveSession(session);
	}

	private void persistIncompleteCall(Instant endedAt) {
		CallSession session = newSession();
		session.markConnected(endedAt.minusSeconds(60));
		session.markUnexpectedDisconnect(endedAt);
		saveSession(session);
	}

	private CallSession newSession() {
		return newSessionFor(careReceiverMember.getId());
	}

	private CallSession newSessionFor(Long careReceiverMemberId) {
		return new CallSession(
			familyGroupRepository.findById(group.getId()).orElseThrow(),
			groupMemberRepository.findById(careReceiverMemberId).orElseThrow(),
			1L,
			CallStatus.CONNECTING);
	}

	private Long saveSession(CallSession session) {
		CallSession saved = callSessionRepository.save(session);
		entityManager.flush();
		entityManager.clear();
		return saved.getId();
	}

	private void persistCallReport(Long callSessionId) {
		callReportRepository.save(new CallReport(
			callSessionRepository.findById(callSessionId).orElseThrow(),
			"통화 요약",
			EmotionCategory.JOY,
			"뿌듯함",
			"약을 잘 드셨어요."));
		entityManager.flush();
		entityManager.clear();
	}

	private User user(String loginId, String name) {
		return new User(loginId, "password-hash", name, LocalDate.of(1955, 4, 9), UserGender.FEMALE);
	}

	private RequestPostProcessor authenticatedAs(Long userId) {
		AuthenticatedUser principal = new AuthenticatedUser(userId, "test-access-token");
		return authentication(new UsernamePasswordAuthenticationToken(principal, null, List.of()));
	}
}
