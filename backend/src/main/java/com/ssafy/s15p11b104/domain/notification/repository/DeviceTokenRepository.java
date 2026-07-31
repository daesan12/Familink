package com.ssafy.s15p11b104.domain.notification.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;

import jakarta.persistence.LockModeType;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select token from DeviceToken token where token.token = :token")
	Optional<DeviceToken> findByTokenForUpdate(@Param("token") String token);

	Optional<DeviceToken> findByToken(String token);

	List<DeviceToken> findAllByUser_IdAndActiveTrue(Long userId);

	@Modifying
	@Query(
		value = """
			update device_tokens
			set is_active = false, updated_at = :updatedAt
			where user_id = :userId and is_active = true
			""",
		nativeQuery = true)
	int deactivateAllByUserId(
		@Param("userId") Long userId,
		@Param("updatedAt") Instant updatedAt);
}
