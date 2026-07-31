package com.ssafy.s15p11b104.domain.notification.config;

import java.io.IOException;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssafy.s15p11b104.domain.notification.push.FirebasePushSender;
import com.ssafy.s15p11b104.domain.notification.service.PushSender;

@Configuration
public class PushConfiguration {

	@Bean
	@ConditionalOnProperty(prefix = "app.push", name = "enabled", havingValue = "false", matchIfMissing = true)
	PushSender disabledPushSender() {
		return message -> PushSender.Result.SENT;
	}

	@Bean
	@ConditionalOnProperty(prefix = "app.push", name = "enabled", havingValue = "true")
	PushSender firebasePushSender() throws IOException {
		String credentialsPath = System.getenv("GOOGLE_APPLICATION_CREDENTIALS");
		if (!StringUtils.hasText(credentialsPath)) {
			throw new IllegalStateException(
				"푸시가 활성화된 환경에는 GOOGLE_APPLICATION_CREDENTIALS가 필요합니다.");
		}

		FirebaseApp firebaseApp = FirebaseApp.getApps().stream()
			.filter(app -> FirebaseApp.DEFAULT_APP_NAME.equals(app.getName()))
			.findFirst()
			.orElseGet(() -> initializeFirebaseApp(credentialsPath));
		return new FirebasePushSender(FirebaseMessaging.getInstance(firebaseApp));
	}

	private FirebaseApp initializeFirebaseApp(String credentialsPath) {
		try {
			GoogleCredentials credentials = GoogleCredentials.getApplicationDefault();
			FirebaseOptions options = FirebaseOptions.builder()
				.setCredentials(credentials)
				.build();
			return FirebaseApp.initializeApp(options);
		} catch (IOException exception) {
			throw new IllegalStateException(
				"Firebase 자격 증명을 불러올 수 없습니다: " + credentialsPath,
				exception);
		}
	}
}
