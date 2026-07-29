package com.ssafy.s15p11b104.domain.feed.analysis;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

final class AnalysisTestFixtures {

	private static final AtomicLong VALUE_SEQUENCE = new AtomicLong();

	private AnalysisTestFixtures() {
	}

	static PostFixture textPost() {
		return new PostFixture(
			content(),
			null,
			List.of(),
			summary());
	}

	static PostFixture photoPost() {
		return new PostFixture(
			content(),
			MediaType.IMAGE,
			List.of(
				new MediaFixture(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg", 1),
				new MediaFixture(MediaType.IMAGE, mediaUri("https", "png"), "image/png", 2),
				new MediaFixture(MediaType.IMAGE, mediaUri("https", "webp"), "image/webp", 3),
				new MediaFixture(MediaType.IMAGE, mediaUri("https", "jpg"), "image/jpeg", 4)),
			summary());
	}

	static PostFixture videoPost() {
		return new PostFixture(
			content(),
			MediaType.VIDEO,
			List.of(new MediaFixture(
				MediaType.VIDEO,
				mediaUri("https", "mp4"),
				"video/mp4",
				1)),
			summary());
	}

	static String content() {
		return generatedValue("content");
	}

	static String mediaUri(String scheme, String extension) {
		long valueId = VALUE_SEQUENCE.incrementAndGet();
		return scheme + "://media-" + valueId + ".invalid/file-" + valueId + "." + extension;
	}

	private static String summary() {
		return generatedValue("summary");
	}

	private static String generatedValue(String prefix) {
		return prefix + "-" + VALUE_SEQUENCE.incrementAndGet();
	}

	record PostFixture(
		String content,
		MediaType mediaType,
		List<MediaFixture> media,
		String expectedSummary) {

		PostFixture {
			media = List.copyOf(media);
		}

		PostContentInput toContentInput() {
			return new PostContentInput(
				content,
				mediaType,
				media.stream().map(MediaFixture::toContentMedia).toList());
		}
	}

	record MediaFixture(MediaType mediaType, String uri, String mimeType, int displayOrder) {

		PostContentMedia toContentMedia() {
			return new PostContentMedia(mediaType, uri, mimeType);
		}
	}
}
