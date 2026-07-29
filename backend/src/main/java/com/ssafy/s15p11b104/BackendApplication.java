package com.ssafy.s15p11b104;

import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@EnableScheduling
public class BackendApplication {

	public static void main(String[] args) {
		configureUtcTimeZone();
		SpringApplication.run(BackendApplication.class, args);
	}

	static void configureUtcTimeZone() {
		TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
	}
}
