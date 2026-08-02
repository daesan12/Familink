package com.ssafy.s15p11b104.domain.notification.push;

import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.ssafy.s15p11b104.domain.notification.service.PushSender;

public class FirebasePushSender implements PushSender {

	private final FirebaseMessaging firebaseMessaging;

	public FirebasePushSender(FirebaseMessaging firebaseMessaging) {
		this.firebaseMessaging = firebaseMessaging;
	}

	@Override
	@SuppressWarnings("deprecation")
	public Result send(Message message) {
		com.google.firebase.messaging.Notification display =
			com.google.firebase.messaging.Notification.builder()
				.setTitle(message.title())
				.setBody(message.body())
				.build();
		com.google.firebase.messaging.Message firebaseMessage =
			com.google.firebase.messaging.Message.builder()
				.setToken(message.token())
				.setNotification(display)
				.putAllData(message.data())
				.build();
		try {
			firebaseMessaging.send(firebaseMessage);
			return Result.SENT;
		} catch (FirebaseMessagingException exception) {
			if (isInvalidToken(exception.getMessagingErrorCode())) {
				return Result.INVALID_TOKEN;
			}
			throw new PushDeliveryException(exception);
		}
	}

	private boolean isInvalidToken(MessagingErrorCode errorCode) {
		return errorCode == MessagingErrorCode.UNREGISTERED
			|| errorCode == MessagingErrorCode.INVALID_ARGUMENT
			|| errorCode == MessagingErrorCode.SENDER_ID_MISMATCH;
	}

	private static final class PushDeliveryException extends RuntimeException {

		private PushDeliveryException(FirebaseMessagingException cause) {
			super(cause);
		}
	}
}
