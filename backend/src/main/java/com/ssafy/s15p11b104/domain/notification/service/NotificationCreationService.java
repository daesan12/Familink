package com.ssafy.s15p11b104.domain.notification.service;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.ssafy.s15p11b104.domain.notification.event.NotificationCreatedEvent;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore.Command;

@Service
public class NotificationCreationService {

	private final NotificationCreationStore notificationCreationStore;
	private final ApplicationEventPublisher eventPublisher;

	public NotificationCreationService(
		NotificationCreationStore notificationCreationStore,
		ApplicationEventPublisher eventPublisher
	) {
		this.notificationCreationStore = notificationCreationStore;
		this.eventPublisher = eventPublisher;
	}

	public void create(Command command) {
		notificationCreationStore.insert(command)
			.ifPresent(notificationId -> eventPublisher.publishEvent(new NotificationCreatedEvent(notificationId)));
	}
}
