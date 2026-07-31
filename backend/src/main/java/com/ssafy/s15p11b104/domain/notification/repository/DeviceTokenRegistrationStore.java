package com.ssafy.s15p11b104.domain.notification.repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DeviceTokenRegistrationStore {

	private static final String INSERT_SQL = """
		insert into device_tokens (
			user_id, token, device_type, is_active, created_at, updated_at
		)
		values (?, ?, ?, true, ?, ?)
		on conflict (token) do nothing
		returning id, device_type, is_active
		""";

	private static final String UPDATE_SQL = """
		update device_tokens
		set user_id = ?, device_type = ?, is_active = true, updated_at = ?
		where token = ?
		returning id, device_type, is_active
		""";

	private final JdbcTemplate jdbcTemplate;

	public DeviceTokenRegistrationStore(JdbcTemplate jdbcTemplate) {
		this.jdbcTemplate = jdbcTemplate;
	}

	public Registration register(Long userId, String token, String deviceType, Instant now) {
		OffsetDateTime timestamp = OffsetDateTime.ofInstant(now, ZoneOffset.UTC);
		List<Registration> inserted = jdbcTemplate.query(
			INSERT_SQL,
			(resultSet, rowNumber) -> map(resultSet.getLong("id"), resultSet.getString("device_type"),
				resultSet.getBoolean("is_active"), true),
			userId,
			token,
			deviceType,
			timestamp,
			timestamp);

		if (!inserted.isEmpty()) {
			return inserted.getFirst();
		}

		return jdbcTemplate.query(
				UPDATE_SQL,
				(resultSet, rowNumber) -> map(resultSet.getLong("id"), resultSet.getString("device_type"),
					resultSet.getBoolean("is_active"), false),
				userId,
				deviceType,
				timestamp,
				token)
			.stream()
			.findFirst()
			.orElseThrow(() -> new IllegalStateException("기기 토큰 등록 결과를 찾을 수 없습니다."));
	}

	private Registration map(Long id, String deviceType, boolean active, boolean created) {
		return new Registration(id, deviceType, active, created);
	}

	public record Registration(Long id, String deviceType, boolean active, boolean created) {
	}
}
