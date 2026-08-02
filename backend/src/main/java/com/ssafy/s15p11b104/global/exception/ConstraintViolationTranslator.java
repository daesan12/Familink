package com.ssafy.s15p11b104.global.exception;

import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

/**
 * DB 제약 위반이 어떤 제약에서 발생했는지 판별한다.
 *
 * <p>사전 검사와 쓰기 사이의 경쟁을 잠금으로 직렬화해도 마지막 방어는 DB 제약이 담당한다.
 * 계약에 정의된 오류 코드로 변환할 수 있는 제약만 판별하고, 그 밖의 위반은 호출자가 그대로
 * 다시 던져 예상하지 못한 실패를 409로 감추지 않는다.
 *
 * <p>대상 제약은 부분 유니크 인덱스이므로 드라이버 경로에 따라 이름이 노출되는 위치가 다르다.
 * Hibernate가 추출한 제약 이름을 먼저 사용하고, 없으면 원인 예외 메시지에 인용된 이름을 찾는다.
 */
@Component
public class ConstraintViolationTranslator {

	private static final String PENDING_JOIN_REQUEST_INDEX = "uq_pending_group_join_request";
	private static final String ACTIVE_CARE_RECEIVER_INDEX = "uq_user_active_care_receiver";

	/**
	 * 같은 그룹·신청자의 대기 중 가입 요청을 한 건으로 제한하는 제약 위반인지 확인한다.
	 */
	public boolean isPendingJoinRequest(DataIntegrityViolationException exception) {
		return matches(exception, PENDING_JOIN_REQUEST_INDEX);
	}

	/**
	 * 한 사용자를 한 그룹의 활성 피보호자로만 제한하는 제약 위반인지 확인한다.
	 */
	public boolean isActiveCareReceiver(DataIntegrityViolationException exception) {
		return matches(exception, ACTIVE_CARE_RECEIVER_INDEX);
	}

	private boolean matches(DataIntegrityViolationException exception, String indexName) {
		String constraintName = findConstraintName(exception);
		if (constraintName != null) {
			return indexName.equalsIgnoreCase(constraintName);
		}

		return containsQuotedIndexName(exception, indexName);
	}

	private String findConstraintName(Throwable exception) {
		for (Throwable cause = exception; cause != null; cause = nextCause(cause)) {
			if (cause instanceof ConstraintViolationException violation && violation.getConstraintName() != null) {
				return violation.getConstraintName();
			}
		}

		return null;
	}

	/**
	 * 제약 이름이 인용된 형태로만 일치를 인정한다.
	 *
	 * <p>PostgreSQL은 위반한 제약 이름을 큰따옴표로 감싸 알리므로, 인용을 요구하면 이름의 일부만
	 * 우연히 겹치는 다른 메시지를 잘못 변환하지 않는다.
	 */
	private boolean containsQuotedIndexName(Throwable exception, String indexName) {
		String quotedIndexName = "\"" + indexName + "\"";
		for (Throwable cause = exception; cause != null; cause = nextCause(cause)) {
			String message = cause.getMessage();
			if (message != null && message.contains(quotedIndexName)) {
				return true;
			}
		}

		return false;
	}

	private Throwable nextCause(Throwable cause) {
		Throwable next = cause.getCause();
		return next == cause ? null : next;
	}
}
