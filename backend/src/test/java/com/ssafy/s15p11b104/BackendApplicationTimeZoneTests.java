package com.ssafy.s15p11b104;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.TimeZone;

import org.junit.jupiter.api.Test;

class BackendApplicationTimeZoneTests {

	@Test
	void applicationUsesUtcAsDefaultTimeZone() {
		TimeZone original = TimeZone.getDefault();
		try {
			BackendApplication.configureUtcTimeZone();

			assertThat(TimeZone.getDefault().getID()).isEqualTo("UTC");
		} finally {
			TimeZone.setDefault(original);
		}
	}
}
