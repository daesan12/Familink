package com.ssafy.s15p11b104.domain.notification.service;

import java.util.Map;

public interface PushSender {

	Result send(Message message);

	enum Result {
		SENT,
		INVALID_TOKEN
	}

	record Message(
		String token,
		String title,
		String body,
		Map<String, String> data
	) {

		public Message {
			data = Map.copyOf(data);
		}
	}
}
