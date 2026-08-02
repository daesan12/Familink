package com.ssafy.s15p11b104.domain.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.s15p11b104.domain.notification.entity.DeviceToken;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore.Command;
import com.ssafy.s15p11b104.domain.notification.service.NotificationCreationService;
import com.ssafy.s15p11b104.domain.notification.service.PushSender;

@AutoConfigureMockMvc
class DomainNotificationTransactionTest extends NotificationApiIntegrationTestSupport {

	@Autowired
	private NotificationCreationService notificationCreationService;

	@Autowired
	private TransactionTemplate transactionTemplate;

	@MockitoBean
	private PushSender pushSender;

	@Test
	void commitsOneNotificationAndPushForDuplicateSourceEvent() {
		TestUser receiver = createUser("receiver", "수신자");
		deviceTokenRepository.saveAndFlush(new DeviceToken(receiver.entity(), "active-token", "ANDROID"));
		when(pushSender.send(any())).thenReturn(PushSender.Result.SENT);
		Command command = command(receiver.entity().getId(), "POST:100:CREATED");

		transactionTemplate.executeWithoutResult(status -> {
			notificationCreationService.create(command);
			notificationCreationService.create(command);
		});

		assertThat(notificationRepository.count()).isEqualTo(1);
		ArgumentCaptor<PushSender.Message> captor = ArgumentCaptor.forClass(PushSender.Message.class);
		verify(pushSender).send(captor.capture());
		assertThat(captor.getValue().data())
			.containsExactlyInAnyOrderEntriesOf(java.util.Map.of(
				"notificationId", "1",
				"type", "NEW_POST"));
	}

	@Test
	void rollsBackNotificationAndNeverPushesWhenOriginalWorkFails() {
		TestUser receiver = createUser("rollback", "롤백 수신자");
		Command command = command(receiver.entity().getId(), "POST:200:CREATED");

		assertThatThrownBy(() -> transactionTemplate.executeWithoutResult(status -> {
			notificationCreationService.create(command);
			throw new IllegalStateException("원 업무 실패");
		})).isInstanceOf(IllegalStateException.class);

		assertThat(notificationRepository.count()).isZero();
		verifyNoInteractions(pushSender);
	}

	@Test
	void concurrentDuplicateSourceEventCreatesOneNotification() throws Exception {
		TestUser receiver = createUser("concurrent", "동시 수신자");
		Command command = command(receiver.entity().getId(), "POST:300:CREATED");
		CountDownLatch ready = new CountDownLatch(2);
		CountDownLatch start = new CountDownLatch(1);
		ExecutorService executor = Executors.newFixedThreadPool(2);
		try {
			Future<?> first = executor.submit(() -> createConcurrently(command, ready, start));
			Future<?> second = executor.submit(() -> createConcurrently(command, ready, start));
			assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
			start.countDown();
			first.get(10, TimeUnit.SECONDS);
			second.get(10, TimeUnit.SECONDS);
		} finally {
			executor.shutdownNow();
		}

		assertThat(notificationRepository.count()).isEqualTo(1);
		verifyNoInteractions(pushSender);
	}

	private void createConcurrently(Command command, CountDownLatch ready, CountDownLatch start) {
		transactionTemplate.executeWithoutResult(status -> {
			ready.countDown();
			try {
				if (!start.await(5, TimeUnit.SECONDS)) {
					throw new IllegalStateException("동시 실행 시작 대기 시간이 초과됐습니다.");
				}
			} catch (InterruptedException exception) {
				Thread.currentThread().interrupt();
				throw new IllegalStateException("동시 실행이 중단됐습니다.", exception);
			}
			notificationCreationService.create(command);
		});
	}

	private Command command(Long receiverUserId, String sourceEventKey) {
		return new Command(
			receiverUserId,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			NotificationType.NEW_POST,
			null,
			"새 게시글이 올라왔어요",
			"작성자님이 새 게시글을 올렸어요.",
			sourceEventKey);
	}
}
