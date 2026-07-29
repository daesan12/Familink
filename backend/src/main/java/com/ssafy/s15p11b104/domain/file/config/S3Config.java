package com.ssafy.s15p11b104.domain.file.config;

import java.net.URI;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
@EnableConfigurationProperties(S3Properties.class)
public class S3Config {

	@Bean(destroyMethod = "close")
	S3Presigner s3Presigner(S3Properties properties) {
		S3Presigner.Builder builder = S3Presigner.builder()
			.region(Region.of(properties.region()));
		if (properties.endpoint() != null && !properties.endpoint().isBlank()) {
			builder
				.endpointOverride(URI.create(properties.endpoint()))
				.serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build());
		}
		return builder.build();
	}
}
