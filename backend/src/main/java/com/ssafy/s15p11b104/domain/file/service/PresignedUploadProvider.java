package com.ssafy.s15p11b104.domain.file.service;

import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
import com.ssafy.s15p11b104.domain.file.dto.UploadResponse;

public interface PresignedUploadProvider {

	UploadResponse issue(String purpose, FileUploadRequest file);
}
