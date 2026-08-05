package com.ssafy.s15p11b104.domain.feed.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * {@code fileUrl}·{@code thumbnailUrl}은 조회 응답의 presigned URL(서명 쿼리 포함 약 1,000자)이
 * 수정 요청으로 되돌아올 수 있어 상한을 2000자로 둔다. object key를 복원할 수 있는 URL은
 * 저장 전에 서명 쿼리를 제거해 500자 이내가 되고, 복원할 수 없는 URL은 저장에 앞서는
 * 미디어 검증이 거절하므로 DB 컬럼 제한(500자)에 닿지 않는다. 검증과 정규화의 순서를
 * 바꾸면 이 전제가 깨진다.
 */
public record PostMediaRequest(
	@NotBlank @Size(max = 2000) String fileUrl,
	@Size(max = 2000) String thumbnailUrl,
	@NotNull @PositiveOrZero Integer displayOrder) {
}
