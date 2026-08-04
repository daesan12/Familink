package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

class CallTeardownExecutorTest {

	@Test
	void executesSubmittedTeardown() {
		AtomicBoolean executed = new AtomicBoolean();
		CallTeardownExecutor executor = new CallTeardownExecutor(Runnable::run);

		executor.execute(() -> executed.set(true));

		assertThat(executed).isTrue();
	}

	@Test
	void configuresBoundedPool() {
		ThreadPoolTaskExecutor executor = new CallTeardownExecutionConfig()
			.callTeardownThreadPool(4, 100);

		assertThat(executor.getCorePoolSize()).isEqualTo(4);
		assertThat(executor.getMaxPoolSize()).isEqualTo(4);
		assertThat(executor.getQueueCapacity()).isEqualTo(100);
	}

	/**
	 * 뒷정리를 유실하면 해당 통화의 건별 리포트가 영구히 생성되지 않으므로, 포화 시 버리는
	 * 대신 호출 스레드가 실행해야 한다. 실제로 풀을 포화시켜 확인하지는 않는다. 워커를
	 * 붙잡아 두면 같은 JVM에서 뒤따르는 통합 테스트의 타이밍을 흔든다.
	 */
	@Test
	void keepsCallerRunsPolicySoSaturationNeverDropsTeardown() {
		ThreadPoolTaskExecutor executor = new CallTeardownExecutionConfig()
			.callTeardownThreadPool(4, 100);
		executor.afterPropertiesSet();
		try {
			assertThat(executor.getThreadPoolExecutor().getRejectedExecutionHandler())
				.isInstanceOf(ThreadPoolExecutor.CallerRunsPolicy.class);
		} finally {
			executor.shutdown();
		}
	}

	@Test
	void rejectsInvalidPoolLimits() {
		CallTeardownExecutionConfig config = new CallTeardownExecutionConfig();

		assertThat(catchIllegalArgument(() -> config.callTeardownThreadPool(0, 100))).isTrue();
		assertThat(catchIllegalArgument(() -> config.callTeardownThreadPool(4, -1))).isTrue();
	}

	private static boolean catchIllegalArgument(Runnable action) {
		try {
			action.run();
			return false;
		} catch (IllegalArgumentException exception) {
			return true;
		}
	}
}
