package com.ssafy.s15p11b104.domain.file.service;

public interface MediaDownloadUrlProvider {

	String issueDownloadUrl(String storedFileUrl);

	String issueProfileImageDownloadUrl(String storedProfileImageUrl);
}
