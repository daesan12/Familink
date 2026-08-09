package com.ssafy.s15p11b104.domain.call.report;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

class DemoCallReportFixtureProviderTest {

	private final DemoCallReportFixtureProvider provider = new DemoCallReportFixtureProvider();

	@Test
	void returnsBoundedFixtureForDemoCareReceiver() {
		CallReportAnalysis analysis = provider.resolve("demoyounghee810").orElseThrow();

		assertThat(analysis.summary()).hasSizeLessThanOrEqualTo(100);
		assertThat(analysis.emotionCategory()).isEqualTo(EmotionCategory.JOY);
		assertThat(analysis.emotionSubcategory()).isEqualTo("기대");
		assertThat(analysis.guardianMessage()).hasSizeLessThanOrEqualTo(100);
	}

	@Test
	void returnsEmptyForOtherCareReceiver() {
		assertThat(provider.resolve("another-user")).isEmpty();
	}
}
