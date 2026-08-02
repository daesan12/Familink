package com.ssafy.s15p11b104.global.ai.execution;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class AiExecutionConfig {

	@Bean(name = "aiTaskThreadPool")
	ThreadPoolTaskExecutor aiTaskThreadPool(
		@Value("${app.ai-execution.max-concurrency:2}") int maxConcurrency,
		@Value("${app.ai-execution.queue-capacity:20}") int queueCapacity
	) {
		if (maxConcurrency <= 0 || queueCapacity < 0) {
			throw new IllegalArgumentException("AI executor limits must be positive");
		}

		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(maxConcurrency);
		executor.setMaxPoolSize(maxConcurrency);
		executor.setQueueCapacity(queueCapacity);
		executor.setThreadNamePrefix("ai-task-");
		executor.setWaitForTasksToCompleteOnShutdown(false);
		executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
		return executor;
	}
}
