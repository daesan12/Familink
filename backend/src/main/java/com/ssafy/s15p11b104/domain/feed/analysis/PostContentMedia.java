package com.ssafy.s15p11b104.domain.feed.analysis;

import com.ssafy.s15p11b104.domain.feed.entity.MediaType;

public record PostContentMedia(MediaType mediaType, String uri, String mimeType) {
}
