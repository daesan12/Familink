package com.ssafy.s15p11b104.global.ai.execution;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicBoolean;

import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

class AiTaskExecutorTest {

	@Test
	void executesAcceptedTask() {
		AtomicBoolean executed = new AtomicBoolean();
		AiTaskExecutor executor = new AiTaskExecutor(Runnable::run);

		boolean accepted = executor.submit(() -> executed.set(true));

		assertThat(accepted).isTrue();
		assertThat(executed).isTrue();
	}

	@Test
	void reportsRejectedTaskWithoutRunningIt() {
		AtomicBoolean executed = new AtomicBoolean();
		AiTaskExecutor executor = new AiTaskExecutor(task -> {
			throw new TaskRejectedException("full");
		});

		boolean accepted = executor.submit(() -> executed.set(true));

		assertThat(accepted).isFalse();
		assertThat(executed).isFalse();
	}

	@Test
	void configuresBoundedTwoWorkerTwentyQueuePool() {
		ThreadPoolTaskExecutor executor = new AiExecutionConfig().aiTaskThreadPool(2, 20);

		assertThat(executor.getCorePoolSize()).isEqualTo(2);
		assertThat(executor.getMaxPoolSize()).isEqualTo(2);
		assertThat(executor.getQueueCapacity()).isEqualTo(20);
	}
}
