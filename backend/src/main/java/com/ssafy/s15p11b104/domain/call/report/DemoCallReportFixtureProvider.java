package com.ssafy.s15p11b104.domain.call.report;

import java.util.Optional;

import org.springframework.stereotype.Component;

import com.ssafy.s15p11b104.domain.report.entity.EmotionCategory;

@Component
public class DemoCallReportFixtureProvider {

	private static final String DEMO_CARE_RECEIVER_LOGIN_ID = "demoyounghee810";
	private static final CallReportAnalysis DEMO_ANALYSIS = new CallReportAnalysis(
		"지우의 생일을 맞아 민수가 준비한 미역국 이야기를 나누며 기쁜 마음을 표현했습니다. "
			+ "가족 일정을 확인한 뒤, 오늘 오후 7시 지우 생일 축하 영상통화를 기대했습니다.",
		EmotionCategory.JOY,
		"기대",
		"민수가 지우의 생일 미역국을 준비한 소식을 확인했으며, "
			+ "오늘 오후 7시 가족 영상통화를 기다리고 있다고 전했습니다."
	);

	public Optional<CallReportAnalysis> resolve(String careReceiverLoginId) {
		if (!DEMO_CARE_RECEIVER_LOGIN_ID.equals(careReceiverLoginId)) {
			return Optional.empty();
		}
		return Optional.of(DEMO_ANALYSIS);
	}
}
