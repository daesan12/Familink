package com.ssafy.s15p11b104;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.call.report.CallReportGenerationService;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.service.AiCallPostToolService;
import com.ssafy.s15p11b104.domain.call.service.AiCallPromptContextProvider;
import com.ssafy.s15p11b104.domain.call.repository.CallSessionRepository;
import com.ssafy.s15p11b104.domain.call.service.CallSessionService;
import com.ssafy.s15p11b104.domain.call.service.CallTranscriptService;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.carnation.repository.CarnationRepository;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostAnalysisRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostMediaRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
import com.ssafy.s15p11b104.domain.group.repository.FamilyGroupRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberInterestRepository;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRegistrationStore;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationSettingRepository;
import com.ssafy.s15p11b104.domain.notification.service.EventReminderService;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;
import com.ssafy.s15p11b104.domain.report.service.DailyReportGenerationService;

import jakarta.persistence.EntityManager;

@SpringBootTest(properties = {
	"spring.autoconfigure.exclude="
		+ "org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,"
		+ "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration,"
		+ "org.springframework.boot.autoconfigure.flyway.FlywayAutoConfiguration,"
		+ "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
		+ "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration"
})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BackendApplicationContextTests {

	@MockitoBean
	private CallSessionService callSessionService;

	@MockitoBean
	private CallTranscriptService callTranscriptService;

	@MockitoBean
	private CallReportGenerationService callReportGenerationService;

	@MockitoBean
	private CallReportCallRepository callReportCallRepository;

	@MockitoBean
	private DailyReportGenerationService dailyReportGenerationService;

	@MockitoBean
	private AiCallPromptContextProvider promptContextProvider;

	@MockitoBean
	private AiCallPostToolService postToolService;

	@Autowired
	private MockMvc mockMvc;

	@MockitoBean
	private UserRepository userRepository;

	@MockitoBean
	private StringRedisTemplate redisTemplate;

	@MockitoBean
	private GroupMemberRepository groupMemberRepository;

	@MockitoBean
	private FamilyGroupRepository familyGroupRepository;

	@MockitoBean
	private GroupJoinRequestRepository groupJoinRequestRepository;

	@MockitoBean
	private EntityManager entityManager;

	@MockitoBean
	private MemberInterestRepository memberInterestRepository;

	@MockitoBean
	private MemberAliasRepository memberAliasRepository;

	@MockitoBean
	private PostRepository postRepository;

	@MockitoBean
	private PostMediaRepository postMediaRepository;

	@MockitoBean
	private PostAnalysisRepository postAnalysisRepository;

	@MockitoBean
	private CommentRepository commentRepository;

	@MockitoBean
	private PostReactionRepository postReactionRepository;

	@MockitoBean
	private CarnationRepository carnationRepository;

	@MockitoBean
	private CalendarEventRepository calendarEventRepository;

	@MockitoBean
	private EventParticipantRepository eventParticipantRepository;

	@MockitoBean
	private DeviceTokenRepository deviceTokenRepository;

	@MockitoBean
	private DeviceTokenRegistrationStore deviceTokenRegistrationStore;

	@MockitoBean
	private NotificationCreationStore notificationCreationStore;

	@MockitoBean
	private NotificationRepository notificationRepository;

	@MockitoBean
	private NotificationSettingRepository notificationSettingRepository;

	@MockitoBean
	private DailyReportRepository dailyReportRepository;

	/**
	 * 이 컨텍스트는 JPA 자동 구성을 제외해 {@code TransactionTemplate} 빈이 없으므로, 그것을
	 * 주입받는 서비스는 목으로 대체한다.
	 */
	@MockitoBean
	private EventReminderService eventReminderService;

	@MockitoBean
	private CallSessionRepository callSessionRepository;

	@Test
	void healthEndpointIsPublic() throws Exception {
		mockMvc.perform(get("/actuator/health"))
			.andExpect(status().isOk());
	}

	@Test
	void openApiEndpointIsPublic() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
			.andExpect(status().isOk());
	}

	@Test
	void authEndpointsArePublic() throws Exception {
		mockMvc.perform(get("/auth/login-id/check").param("loginId", "testuser"))
			.andExpect(status().isOk());
	}

	@Test
	void logoutRequiresAuthentication() throws Exception {
		mockMvc.perform(post("/auth/logout"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	void unknownEndpointRequiresAuthentication() throws Exception {
		mockMvc.perform(get("/not-configured"))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.success").value(false))
			.andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
			.andExpect(jsonPath("$.errors").isArray());
	}
}
