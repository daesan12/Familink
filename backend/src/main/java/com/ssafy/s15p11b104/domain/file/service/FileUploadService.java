package com.ssafy.s15p11b104.domain.file.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.file.dto.PresignedUrlRequest;
import com.ssafy.s15p11b104.domain.file.dto.PresignedUrlResponse;

@Service
public class FileUploadService {

	private final PresignedUploadProvider uploadProvider;
	private final MediaUploadPolicy mediaUploadPolicy;

	public FileUploadService(PresignedUploadProvider uploadProvider, MediaUploadPolicy mediaUploadPolicy) {
		this.uploadProvider = uploadProvider;
		this.mediaUploadPolicy = mediaUploadPolicy;
	}

	@Transactional(readOnly = true)
	public PresignedUrlResponse issue(PresignedUrlRequest request, Long authenticatedUserId) {
		String purpose = request.purpose().trim();
		request.files().forEach(file -> mediaUploadPolicy.validatePresignedRequest(purpose, file));
		return new PresignedUrlResponse(request.files().stream()
			.map(file -> uploadProvider.issue(purpose, file))
			.toList());
	}
}
