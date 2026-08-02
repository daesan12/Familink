package com.ssafy.s15p11b104.domain.feed.analysis;

/**
 * 업로드·스토리지 메타데이터에서 미디어 MIME 타입을 조회한다.
 */
public interface MediaMimeTypeProvider {

	/**
	 * 미디어 URI에 대응하는 MIME 타입을 반환한다.
	 *
	 * @param mediaUri MIME 타입을 조회할 미디어 URI
	 * @return MIME 타입. 알 수 없으면 {@code null} 또는 빈 문자열
	 */
	String getMimeType(String mediaUri);
}
