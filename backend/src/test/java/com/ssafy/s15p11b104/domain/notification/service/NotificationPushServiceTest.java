package com.ssafy.s15p11b104.domain.notification.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationSetting;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.repository.DeviceTokenRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationSettingRepository;

@ExtendWith(MockitoExtension.class)
class NotificationPushServiceTest {

	@Mock
	private NotificationRepository notificationRepository;

	@Mock
	private NotificationSettingRepository notificationSettingRepository;

	@Mock
	private DeviceTokenRepository deviceTokenRepository;

	@Mock
	private PushSender pushSender;

	@Mock
	private Notification notification;

	@Mock
	private User receiver;

	@Mock
	private DeviceToken firstToken;

	@Mock
	private DeviceToken secondToken;

	private NotificationPushService pushService;

	@BeforeEach
	void setUp() {
		pushService = new NotificationPushService(
			notificationRepository,
			notificationSettingRepository,
			deviceTokenRepository,
			pushSender);
		lenient().when(notificationRepository.findById(1L)).thenReturn(Optional.of(notification));
		lenient().when(notification.getId()).thenReturn(1L);
		lenient().when(notification.getReceiver()).thenReturn(receiver);
		lenient().when(receiver.getId()).thenReturn(10L);
		lenient().when(notification.getType()).thenReturn(NotificationType.NEW_POST);
	}

	@Test
	void skipsPushWhenReceiverDisabledTheType() {
		NotificationSetting setting = new NotificationSetting(receiver, NotificationType.NEW_POST, false);
		when(notificationSettingRepository.findByUser_IdAndNotificationType(10L, NotificationType.NEW_POST))
			.thenReturn(Optional.of(setting));

		pushService.dispatch(1L);

		verify(deviceTokenRepository, never()).findAllByUser_IdAndActiveTrue(any());
		verify(pushSender, never()).send(any());
	}

	@Test
	void sendsOnlyIdAndTypeDataToEveryActiveToken() {
		when(notificationSettingRepository.findByUser_IdAndNotificationType(10L, NotificationType.NEW_POST))
			.thenReturn(Optional.empty());
		when(deviceTokenRepository.findAllByUser_IdAndActiveTrue(10L)).thenReturn(List.of(firstToken, secondToken));
		when(firstToken.getToken()).thenReturn("first-token");
		when(secondToken.getToken()).thenReturn("second-token");
		when(notification.getTitle()).thenReturn("제목");
		when(notification.getBody()).thenReturn("본문");
		when(pushSender.send(any())).thenReturn(PushSender.Result.SENT);

		pushService.dispatch(1L);

		ArgumentCaptor<PushSender.Message> captor = ArgumentCaptor.forClass(PushSender.Message.class);
		verify(pushSender, org.mockito.Mockito.times(2)).send(captor.capture());
		assertThatCode(() -> captor.getAllValues().forEach(message -> {
			org.assertj.core.api.Assertions.assertThat(message.data())
				.containsExactlyInAnyOrderEntriesOf(java.util.Map.of(
					"notificationId", "1",
					"type", "NEW_POST"));
		})).doesNotThrowAnyException();
	}

	@Test
	void deactivatesOnlyInvalidTokenAndDoesNotPropagateTransientFailure() {
		when(notificationSettingRepository.findByUser_IdAndNotificationType(10L, NotificationType.NEW_POST))
			.thenReturn(Optional.empty());
		when(deviceTokenRepository.findAllByUser_IdAndActiveTrue(10L)).thenReturn(List.of(firstToken, secondToken));
		when(firstToken.getToken()).thenReturn("invalid-token");
		when(secondToken.getToken()).thenReturn("temporary-failure-token");
		when(notification.getTitle()).thenReturn("제목");
		when(notification.getBody()).thenReturn("본문");
		when(pushSender.send(any()))
			.thenReturn(PushSender.Result.INVALID_TOKEN)
			.thenThrow(new IllegalStateException("temporary"));

		assertThatCode(() -> pushService.dispatch(1L)).doesNotThrowAnyException();

		verify(firstToken).deactivate();
		verify(secondToken, never()).deactivate();
	}
}
