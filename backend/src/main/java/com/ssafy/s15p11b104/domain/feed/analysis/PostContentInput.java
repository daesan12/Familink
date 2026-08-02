package com.ssafy.s15p11b104.domain.feed.analysis;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

public record PostContentInput(String content, MediaType mediaType, List<PostContentMedia> media) {

	public PostContentInput {
		media = media == null
			? List.of()
			: Collections.unmodifiableList(new ArrayList<>(media));
	}
}
