package com.ssafy.s15p11b104.domain.notification.service;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationSettingRepository;

@Service
public class NotificationPushService {

	private static final Logger LOGGER = LoggerFactory.getLogger(NotificationPushService.class);

	private final NotificationRepository notificationRepository;
	private final NotificationSettingRepository notificationSettingRepository;
	private final DeviceTokenRepository deviceTokenRepository;
	private final PushSender pushSender;

	public NotificationPushService(
		NotificationRepository notificationRepository,
		NotificationSettingRepository notificationSettingRepository,
		DeviceTokenRepository deviceTokenRepository,
		PushSender pushSender
	) {
		this.notificationRepository = notificationRepository;
		this.notificationSettingRepository = notificationSettingRepository;
		this.deviceTokenRepository = deviceTokenRepository;
		this.pushSender = pushSender;
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void dispatch(Long notificationId) {
		Notification notification = notificationRepository.findById(notificationId).orElse(null);
		if (notification == null) {
			return;
		}

		Long receiverUserId = notification.getReceiver().getId();
		boolean enabled = notificationSettingRepository
			.findByUser_IdAndNotificationType(receiverUserId, notification.getType())
			.map(setting -> setting.isEnabled())
			.orElse(true);
		if (!enabled) {
			return;
		}

		Map<String, String> data = Map.of(
			"notificationId", notification.getId().toString(),
			"type", notification.getType().name());
		for (DeviceToken token : deviceTokenRepository.findAllByUser_IdAndActiveTrue(receiverUserId)) {
			send(notification, token, data);
		}
	}

	private void send(Notification notification, DeviceToken token, Map<String, String> data) {
		try {
			PushSender.Result result = pushSender.send(new PushSender.Message(
				token.getToken(),
				notification.getTitle(),
				notification.getBody(),
				data));
			if (result == PushSender.Result.INVALID_TOKEN) {
				token.deactivate();
			}
		} catch (RuntimeException exception) {
			LOGGER.error(
				"푸시 전송에 실패했습니다. notificationId={}, deviceTokenId={}, errorType={}",
				notification.getId(),
				token.getId(),
				exception.getClass().getSimpleName());
		}
	}
}
