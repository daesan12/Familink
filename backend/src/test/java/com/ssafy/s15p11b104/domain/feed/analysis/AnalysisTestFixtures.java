package com.ssafy.s15p11b104.domain.feed.analysis;

import java.util.List;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

final class AnalysisTestFixtures {

	private AnalysisTestFixtures() {
	}

	static PostFixture textPost() {
		return new PostFixture(
			"지난 주말 아이들과 동네 공원에 다녀왔다. 봄꽃을 구경하고 잔디밭에서 함께 놀았다.",
			null,
			List.of(),
			"아이들과 동네 공원에서 봄꽃을 구경하고 즐거운 시간을 보냈다.");
	}

	static PostFixture photoPost() {
		return new PostFixture(
			"엄마 생신을 맞아 가족들과 작은 파티를 열었다. 케이크를 함께 먹고 기념사진도 남겼다.",
			MediaType.IMAGE,
			List.of(
				new MediaFixture(MediaType.IMAGE, "https://test-cdn.example.com/family-cake.jpg", "image/jpeg", 1),
				new MediaFixture(MediaType.IMAGE, "https://test-cdn.example.com/family-table.png", "image/png", 2),
				new MediaFixture(MediaType.IMAGE, "https://test-cdn.example.com/birthday-card.webp", "image/webp", 3),
				new MediaFixture(MediaType.IMAGE, "https://test-cdn.example.com/family-photo.jpg", "image/jpeg", 4)),
			"가족들이 어머니의 생일을 축하하며 케이크를 먹고 기념사진을 남겼다.");
	}

	static PostFixture videoPost() {
		return new PostFixture(
			"아이들이 처음으로 자전거를 타는 날이라 집 앞 산책로에 나갔다. 끝까지 혼자 달리는 모습이 인상적이었다.",
			MediaType.VIDEO,
			List.of(new MediaFixture(
				MediaType.VIDEO,
				"https://test-cdn.example.com/first-bike-ride.mp4",
				"video/mp4",
				1)),
			"아이들이 집 앞 산책로에서 처음으로 자전거를 타며 혼자 달리는 경험을 했다.");
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
