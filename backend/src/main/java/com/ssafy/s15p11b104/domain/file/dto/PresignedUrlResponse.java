package com.ssafy.s15p11b104.domain.file.dto;

import java.util.List;

public record PresignedUrlResponse(List<UploadResponse> uploads) {
}
