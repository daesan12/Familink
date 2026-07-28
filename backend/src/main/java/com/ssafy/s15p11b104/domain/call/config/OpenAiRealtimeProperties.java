package com.ssafy.s15p11b104.domain.call.config;

import java.net.URI;
import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "openai.realtime")
public class OpenAiRealtimeProperties {

	private String apiKey;
	private String model = "gpt-realtime-2";
	private URI baseUrl = URI.create("https://api.openai.com");
	private URI sidebandUrl = URI.create("wss://api.openai.com/v1/realtime");
	private Duration connectTimeout = Duration.ofSeconds(5);
	private Duration requestTimeout = Duration.ofSeconds(20);

	public String getApiKey() {
		return apiKey;
	}

	public void setApiKey(String apiKey) {
		this.apiKey = apiKey;
	}

	public String getModel() {
		return model;
	}

	public void setModel(String model) {
		this.model = model;
	}

	public URI getBaseUrl() {
		return baseUrl;
	}

	public void setBaseUrl(URI baseUrl) {
		this.baseUrl = baseUrl;
	}

	public URI getSidebandUrl() {
		return sidebandUrl;
	}

	public void setSidebandUrl(URI sidebandUrl) {
		this.sidebandUrl = sidebandUrl;
	}

	public Duration getConnectTimeout() {
		return connectTimeout;
	}

	public void setConnectTimeout(Duration connectTimeout) {
		this.connectTimeout = connectTimeout;
	}

	public Duration getRequestTimeout() {
		return requestTimeout;
	}

	public void setRequestTimeout(Duration requestTimeout) {
		this.requestTimeout = requestTimeout;
	}
}
