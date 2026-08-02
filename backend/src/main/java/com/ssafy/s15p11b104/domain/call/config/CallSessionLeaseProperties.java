package com.ssafy.s15p11b104.domain.call.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.ai-call-lease")
public class CallSessionLeaseProperties {

	private Duration leaseDuration = Duration.ofSeconds(90);

	public Duration getLeaseDuration() {
		return leaseDuration;
	}

	public void setLeaseDuration(Duration leaseDuration) {
		if (leaseDuration == null || leaseDuration.isZero() || leaseDuration.isNegative()) {
			throw new IllegalArgumentException("AI 통화 lease 시간은 0보다 커야 합니다.");
		}
		this.leaseDuration = leaseDuration;
	}
}
