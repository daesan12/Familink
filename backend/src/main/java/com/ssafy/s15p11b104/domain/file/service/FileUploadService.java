package com.ssafy.s15p11b104.domain.file.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.file.dto.FileUploadRequest;
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
		List<FileUploadRequest> files = mediaUploadPolicy.validate(request.purpose(), request.files());
		return new PresignedUrlResponse(files.stream()
			.map(file -> uploadProvider.issue(request.purpose(), file))
			.toList());
	}
}
