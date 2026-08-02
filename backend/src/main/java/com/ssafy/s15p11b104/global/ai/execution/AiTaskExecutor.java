package com.ssafy.s15p11b104.global.ai.execution;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.stereotype.Component;

@Component
public class AiTaskExecutor {

	private final TaskExecutor taskExecutor;

	public AiTaskExecutor(@Qualifier("aiTaskThreadPool") TaskExecutor taskExecutor) {
		this.taskExecutor = taskExecutor;
	}

	/**
	 * AI 작업을 bounded executor에 제출한다.
	 *
	 * @return 제출됐으면 {@code true}, 포화 상태에서 거부됐으면 {@code false}
	 */
	public boolean submit(Runnable task) {
		try {
			taskExecutor.execute(task);
			return true;
		} catch (TaskRejectedException exception) {
			return false;
		}
	}
}
