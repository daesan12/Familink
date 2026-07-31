package com.ssafy.s15p11b104.domain.notification.service;

import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.ssafy.s15p11b104.domain.notification.event.NotificationCreatedEvent;

@Component
public class NotificationPushListener {

	private final NotificationPushService notificationPushService;

	public NotificationPushListener(NotificationPushService notificationPushService) {
		this.notificationPushService = notificationPushService;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void onNotificationCreated(NotificationCreatedEvent event) {
		notificationPushService.dispatch(event.notificationId());
	}
}
