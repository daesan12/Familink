package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Instant;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationSettingsResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationSettingsUpdateRequest;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationSettingsUpdateResponse;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationSetting;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationSettingRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class NotificationSettingService {

	private final UserRepository userRepository;
	private final NotificationSettingRepository notificationSettingRepository;

	public NotificationSettingService(
		UserRepository userRepository,
		NotificationSettingRepository notificationSettingRepository
	) {
		this.userRepository = userRepository;
		this.notificationSettingRepository = notificationSettingRepository;
	}

	@Transactional(readOnly = true)
	public NotificationSettingsResponse getSettings(Long userId) {
		requireActiveUser(userId);
		Map<NotificationType, Boolean> saved = new EnumMap<>(NotificationType.class);
		notificationSettingRepository.findAllByUser_Id(userId)
			.forEach(setting -> saved.put(setting.getNotificationType(), setting.isEnabled()));

		List<NotificationSettingsResponse.Setting> settings = EnumSet
			.allOf(NotificationType.class)
			.stream()
			.map(type -> new NotificationSettingsResponse.Setting(
				type,
				saved.getOrDefault(type, true)))
			.toList();
		return new NotificationSettingsResponse(settings);
	}

	@Transactional
	public NotificationSettingsUpdateResponse updateSettings(
		Long userId,
		NotificationSettingsUpdateRequest request
	) {
		User user = requireActiveUserForUpdate(userId);
		Map<NotificationType, Boolean> requested = validateAndIndex(request);
		Map<NotificationType, NotificationSetting> saved = new EnumMap<>(NotificationType.class);
		notificationSettingRepository.findAllByUser_Id(userId)
			.forEach(setting -> saved.put(setting.getNotificationType(), setting));

		List<NotificationSetting> settings = EnumSet
			.allOf(NotificationType.class)
			.stream()
			.map(type -> {
				NotificationSetting setting = saved.get(type);
				if (setting == null) {
					return new NotificationSetting(user, type, requested.get(type));
				}
				setting.updateEnabled(requested.get(type));
				return setting;
			})
			.toList();

		List<NotificationSetting> updated = notificationSettingRepository.saveAllAndFlush(settings);
		Instant updatedAt = updated.stream()
			.map(NotificationSetting::getUpdatedAt)
			.max(Instant::compareTo)
			.orElseThrow();
		return new NotificationSettingsUpdateResponse(updatedAt);
	}

	private Map<NotificationType, Boolean> validateAndIndex(NotificationSettingsUpdateRequest request) {
		Map<NotificationType, Boolean> requested = new EnumMap<>(NotificationType.class);
		for (NotificationSettingsUpdateRequest.Setting setting : request.settings()) {
			if (requested.put(setting.notificationType(), setting.enabled()) != null) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
		}
		if (!requested.keySet().equals(EnumSet.allOf(NotificationType.class))) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return requested;
	}

	private User requireActiveUser(Long userId) {
		return userRepository.findByIdAndWithdrawnAtIsNull(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
	}

	private User requireActiveUserForUpdate(Long userId) {
		return userRepository.findActiveByIdForUpdate(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
	}
}
