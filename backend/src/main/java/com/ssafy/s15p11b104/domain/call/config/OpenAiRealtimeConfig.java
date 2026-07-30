package com.ssafy.s15p11b104.domain.call.config;

import java.net.http.HttpClient;
import java.time.Clock;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class OpenAiRealtimeConfig {

	@Bean
	RestClient openAiRealtimeRestClient(OpenAiRealtimeProperties properties) {
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory();
		requestFactory.setReadTimeout(properties.getRequestTimeout());

		return RestClient.builder()
			.baseUrl(properties.getBaseUrl().toString())
			.requestFactory(requestFactory)
			.build();
	}

	@Bean
	HttpClient openAiSidebandHttpClient(OpenAiRealtimeProperties properties) {
		return HttpClient.newBuilder()
			.connectTimeout(properties.getConnectTimeout())
			.build();
	}

	@Bean
	Clock applicationClock() {
		return Clock.systemUTC();
	}
}
