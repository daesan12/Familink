package com.ssafy.s15p11b104.domain.call.service;

import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class CallTeardownExecutionConfig {

	/** 기본 설정(워커 4·대기열 40)에서 남은 뒷정리가 최대 2초 drain을 끝낼 수 있는 시간이다. */
	private static final int SHUTDOWN_AWAIT_SECONDS = 30;

	/**
	 * 통화 종료 뒷정리 전용 실행기다.
	 *
	 * <p>AI 작업 풀을 재사용하지 않는다. 그 풀은 워커가 2개뿐이고 Gemini 호출과 게시글
	 * 분석이 공유하므로, 최대 2초 drain과 OpenAI hangup을 기다리는 뒷정리가 섞이면 서로를
	 * 굶긴다.
	 *
	 * <p>포화 시 {@link ThreadPoolExecutor.CallerRunsPolicy}로 요청 스레드가 직접 실행한다.
	 * 뒷정리를 버리면 전사 마감이 일어나지 않아 해당 통화의 건별 리포트가 영구히 생성되지
	 * 않으므로, 유실 대신 변경 전과 같은 응답 지연으로만 퇴화시킨다. 같은 이유로 종료 시
	 * 큐를 버리지 않고 기다리며, 대기 시간은 최악의 잔여 작업(대기열 × drain 2초 ÷ 워커)을
	 * 덮도록 잡는다.
	 *
	 * <p>한 가지 예외가 있다. {@code CallerRunsPolicy}는 풀이 이미 shutdown된 뒤 거부된
	 * 작업을 예외 없이 버린다. 즉 종료 대기 시간을 넘긴 배포 중 뒷정리는 유실될 수 있으며,
	 * 그 통화는 90초 뒤 watchdog이 전사 무결성을 {@code RECONCILIATION_REQUIRED}로 닫아
	 * 리포트를 만들지 않는다.
	 */
	@Bean(name = "callTeardownThreadPool")
	ThreadPoolTaskExecutor callTeardownThreadPool(
		@Value("${app.call-teardown.max-concurrency:4}") int maxConcurrency,
		@Value("${app.call-teardown.queue-capacity:40}") int queueCapacity
	) {
		if (maxConcurrency <= 0 || queueCapacity < 0) {
			throw new IllegalArgumentException("Call teardown executor limits must be positive");
		}

		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setCorePoolSize(maxConcurrency);
		executor.setMaxPoolSize(maxConcurrency);
		executor.setQueueCapacity(queueCapacity);
		executor.setThreadNamePrefix("call-teardown-");
		executor.setWaitForTasksToCompleteOnShutdown(true);
		executor.setAwaitTerminationSeconds(SHUTDOWN_AWAIT_SECONDS);
		executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
		return executor;
	}
}
