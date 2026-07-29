package com.ssafy.s15p11b104.domain.feed.dto;

import java.util.List;

public record PostListResponse(List<PostListItem> content, boolean hasNext) {
}
