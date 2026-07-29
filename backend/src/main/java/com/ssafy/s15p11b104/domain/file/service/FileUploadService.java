package com.ssafy.s15p11b104.domain.file.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.file.dto.PresignedUrlRequest;
import com.ssafy.s15p11b104.domain.file.dto.PresignedUrlResponse;

@Service
public class FileUploadService {

	private final PresignedUploadProvider uploadProvider;

	public FileUploadService(PresignedUploadProvider uploadProvider) {
		this.uploadProvider = uploadProvider;
	}

	@Transactional(readOnly = true)
	public PresignedUrlResponse issue(PresignedUrlRequest request, Long authenticatedUserId) {
		return new PresignedUrlResponse(request.files().stream()
			.map(file -> uploadProvider.issue(request.purpose().trim(), file))
			.toList());
	}
}
