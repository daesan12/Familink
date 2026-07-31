package com.ssafy.s15p11b104.domain.notification;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import java.time.LocalDate;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationSettingRepository;
import com.ssafy.s15p11b104.global.security.AccessTokenProvider;
import com.ssafy.s15p11b104.support.IntegrationTest;

abstract class NotificationApiIntegrationTestSupport extends IntegrationTest {

	@Autowired
	protected MockMvc mockMvc;

	@Autowired
	protected ObjectMapper objectMapper;

	@Autowired
	protected UserRepository userRepository;

	@Autowired
	protected NotificationRepository notificationRepository;

	@Autowired
	protected NotificationSettingRepository notificationSettingRepository;

	@Autowired
	protected DeviceTokenRepository deviceTokenRepository;

	@Autowired
	protected JdbcTemplate jdbcTemplate;

	@Autowired
	private AccessTokenProvider accessTokenProvider;

	@Autowired
	private StringRedisTemplate redisTemplate;

	@BeforeEach
	void resetNotificationState() {
		jdbcTemplate.execute("truncate table users, family_groups restart identity cascade");
		try (RedisConnection connection = redisTemplate.getRequiredConnectionFactory().getConnection()) {
			connection.serverCommands().flushDb();
		}
	}

	protected TestUser createUser(String loginId, String name) {
		User user = userRepository.saveAndFlush(new User(
			loginId,
			"unused-password-hash",
			name,
			LocalDate.of(1990, 1, 1),
			UserGender.MALE));
		return new TestUser(user, accessTokenProvider.issue(user.getId()));
	}

	protected MockHttpServletRequestBuilder authorized(
		MockHttpServletRequestBuilder request,
		TestUser user
	) {
		return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + user.accessToken());
	}

	protected MockHttpServletRequestBuilder getRequest(String path) {
		return get(path);
	}

	protected MockHttpServletRequestBuilder postRequest(String path) {
		return post(path);
	}

	protected MockHttpServletRequestBuilder patchRequest(String path, Object... uriVariables) {
		return patch(path, uriVariables);
	}

	protected MockHttpServletRequestBuilder putRequest(String path) {
		return put(path);
	}

	protected MockHttpServletRequestBuilder deleteRequest(String path) {
		return delete(path);
	}

	protected record TestUser(User entity, String accessToken) {
	}
}
