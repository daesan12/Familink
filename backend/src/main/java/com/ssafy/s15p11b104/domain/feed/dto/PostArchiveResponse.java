package com.ssafy.s15p11b104.domain.feed.dto;

import java.util.List;

public record PostArchiveResponse(List<ArchiveDateResponse> dates, boolean hasNext) {
	public PostArchiveResponse(List<ArchiveDateResponse> dates) {
		this(dates, false);
	}
}
