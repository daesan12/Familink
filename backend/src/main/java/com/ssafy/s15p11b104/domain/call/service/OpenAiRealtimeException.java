package com.ssafy.s15p11b104.domain.call.service;

public class OpenAiRealtimeException extends RuntimeException {

	public OpenAiRealtimeException(String message) {
		super(message);
	}

	public OpenAiRealtimeException(String message, Throwable cause) {
		super(message, cause);
	}
}
