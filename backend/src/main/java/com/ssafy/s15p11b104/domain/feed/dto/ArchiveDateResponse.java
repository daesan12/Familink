package com.ssafy.s15p11b104.domain.feed.dto;

import java.time.LocalDate;
import java.util.List;

public record ArchiveDateResponse(LocalDate date, List<ArchiveItemResponse> items) {
}
