package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.Instant;

public record CommentUpdateResponse(Long id, String content, Instant updatedAt) {
}
