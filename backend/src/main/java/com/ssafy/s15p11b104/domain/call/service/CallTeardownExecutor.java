package com.ssafy.s15p11b104.domain.call.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.stereotype.Component;

@Component
public class CallTeardownExecutor {

	private final TaskExecutor taskExecutor;

	public CallTeardownExecutor(@Qualifier("callTeardownThreadPool") TaskExecutor taskExecutor) {
		this.taskExecutor = taskExecutor;
	}

	/**
	 * 통화 종료 뒷정리를 실행기에 넘긴다.
	 *
	 * <p>{@code AiTaskExecutor}와 달리 제출 성공 여부를 반환하지 않는다. 이 실행기는 포화 시
	 * 호출 스레드가 직접 실행하므로 거부라는 결과가 없다.
	 */
	public void execute(Runnable task) {
		taskExecutor.execute(task);
	}
}
