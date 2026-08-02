package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Instant;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.notification.dto.DeviceTokenDeleteRequest;
import com.ssafy.s15p11b104.domain.notification.dto.DeviceTokenRegisterRequest;
import com.ssafy.s15p11b104.domain.notification.dto.DeviceTokenResponse;
import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRegistrationStore;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class DeviceTokenService {

	private final UserRepository userRepository;
	private final DeviceTokenRepository deviceTokenRepository;
	private final DeviceTokenRegistrationStore registrationStore;

	public DeviceTokenService(
		UserRepository userRepository,
		DeviceTokenRepository deviceTokenRepository,
		DeviceTokenRegistrationStore registrationStore
	) {
		this.userRepository = userRepository;
		this.deviceTokenRepository = deviceTokenRepository;
		this.registrationStore = registrationStore;
	}

	@Transactional
	public RegistrationResult register(Long userId, DeviceTokenRegisterRequest request) {
		requireActiveUserForUpdate(userId);
		DeviceTokenRegistrationStore.Registration registration = registrationStore.register(
			userId,
			request.token(),
			request.deviceType(),
			Instant.now());

		return new RegistrationResult(
			new DeviceTokenResponse(registration.id(), registration.deviceType(), registration.active()),
			registration.created());
	}

	@Transactional
	public void deactivate(Long userId, DeviceTokenDeleteRequest request) {
		requireActiveUserForUpdate(userId);
		DeviceToken token = deviceTokenRepository.findByTokenForUpdate(request.token()).orElse(null);
		if (token == null) {
			return;
		}
		if (!token.getUser().getId().equals(userId)) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		token.deactivate();
	}

	private void requireActiveUserForUpdate(Long userId) {
		userRepository.findActiveByIdForUpdate(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
	}

	public record RegistrationResult(DeviceTokenResponse response, boolean created) {
	}
}
