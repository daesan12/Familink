package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.Instant;
import java.util.List;

public record PostCreateResponse(List<PostCreatedItem> posts, Instant createdAt) {
}
