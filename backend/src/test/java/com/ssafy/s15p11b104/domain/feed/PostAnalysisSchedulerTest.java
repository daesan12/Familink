package com.ssafy.s15p11b104.domain.feed;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.lang.reflect.Method;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.PropertySource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.Scheduled;

import com.ssafy.s15p11b104.domain.feed.service.PostAnalysisScheduler;

class PostAnalysisSchedulerTest {

	@Test
	void schedulerChecksForNewPostsEveryThreeSecondsByDefault() throws NoSuchMethodException {
		Method scheduleMethod = PostAnalysisScheduler.class.getDeclaredMethod("schedule");
		Scheduled scheduled = scheduleMethod.getAnnotation(Scheduled.class);

		assertThat(scheduled.fixedDelayString()).isEqualTo("${app.ai-analysis.fixed-delay-ms:3000}");
		assertThat(scheduled.initialDelayString()).isEqualTo("${app.ai-analysis.initial-delay-ms:3000}");
	}

	@Test
	void applicationConfigurationChecksForNewPostsEveryThreeSeconds() throws IOException {
		List<PropertySource<?>> propertySources = new YamlPropertySourceLoader()
			.load("application", new ClassPathResource("application.yml"));
		PropertySource<?> applicationProperties = propertySources.getFirst();

		assertThat(applicationProperties.getProperty("app.ai-analysis.fixed-delay-ms")).isEqualTo(3000);
		assertThat(applicationProperties.getProperty("app.ai-analysis.initial-delay-ms")).isEqualTo(3000);
	}
}
