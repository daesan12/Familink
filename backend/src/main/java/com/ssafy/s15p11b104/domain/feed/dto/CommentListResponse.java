package com.ssafy.s15p11b104.domain.feed.dto;

import java.util.List;

public record CommentListResponse(List<CommentResponse> content, boolean hasNext) {
}
