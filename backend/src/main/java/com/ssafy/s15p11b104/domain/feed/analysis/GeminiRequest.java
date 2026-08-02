package com.ssafy.s15p11b104.domain.feed.analysis;

import java.util.List;

public record GeminiRequest(String model, String prompt, List<PostContentMedia> media) {

	public GeminiRequest {
		media = List.copyOf(media);
	}
}
