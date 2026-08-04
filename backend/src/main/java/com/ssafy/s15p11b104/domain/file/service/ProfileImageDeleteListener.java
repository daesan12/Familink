package com.ssafy.s15p11b104.domain.file.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.ssafy.s15p11b104.domain.file.config.S3Properties;
import com.ssafy.s15p11b104.domain.file.event.ProfileImageDeleteRequestedEvent;

import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;

@Component
public class ProfileImageDeleteListener {

	private static final Logger log = LoggerFactory.getLogger(ProfileImageDeleteListener.class);

	private final S3Client s3Client;
	private final S3Properties properties;
	private final S3ObjectKeyResolver objectKeyResolver;

	public ProfileImageDeleteListener(
		S3Client s3Client,
		S3Properties properties,
		S3ObjectKeyResolver objectKeyResolver
	) {
		this.s3Client = s3Client;
		this.properties = properties;
		this.objectKeyResolver = objectKeyResolver;
	}

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void deleteAfterCommit(ProfileImageDeleteRequestedEvent event) {
		objectKeyResolver.resolveProfileImage(event.canonicalUrl())
			.ifPresentOrElse(
				this::deleteObject,
				() -> log.warn("프로필 이미지 삭제를 건너뜁니다. 허용되지 않은 URL입니다: {}", event.canonicalUrl())
			);
	}

	private void deleteObject(String key) {
		try {
			s3Client.deleteObject(DeleteObjectRequest.builder()
				.bucket(properties.bucket())
				.key(key)
				.build());
		} catch (RuntimeException exception) {
			log.warn("프로필 이미지 S3 객체 삭제에 실패했습니다. key={}", key, exception);
		}
	}
}
