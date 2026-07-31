package com.ssafy.s15p11b104.domain.report.dto;

import java.time.Instant;

/**
 * 일일 리포트 화면의 통화 목록 항목이다.
 *
 * <p>{@code reportAvailable}은 이 통화의 건별 리포트가 저장되어 있는지를 뜻하며, 보호자가 건별
 * 리포트를 열 수 있는지 판단하는 근거다. 목록에는 정상 종료된 통화만 담기고 그 통화는 연결에
 * 성공했을 때만 종료될 수 있으므로 {@code startedAt}은 항상 값이 있다.
 */
public record DailyCallItemResponse(Long callSessionId, Instant startedAt, boolean reportAvailable) {
}
