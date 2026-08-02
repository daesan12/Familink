package com.ssafy.s15p11b104.global.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;

import org.hibernate.exception.ConstraintViolationException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * 계약된 오류로 바꿀 제약만 판별하는지 확인한다.
 *
 * <p>무관한 제약까지 참으로 판별하면 예상하지 못한 실패가 409로 감춰지므로, 거짓을 돌려주는 경우를
 * 함께 고정한다.
 */
class ConstraintViolationTranslatorTest {

	private static final String PENDING_JOIN_REQUEST_INDEX = "uq_pending_group_join_request";
	private static final String ACTIVE_CARE_RECEIVER_INDEX = "uq_user_active_care_receiver";

	private final ConstraintViolationTranslator translator = new ConstraintViolationTranslator();

	@Test
	void recognizesPendingJoinRequestConstraintByName() {
		DataIntegrityViolationException exception = withConstraintName(PENDING_JOIN_REQUEST_INDEX);

		assertThat(translator.isPendingJoinRequest(exception)).isTrue();
		assertThat(translator.isActiveCareReceiver(exception)).isFalse();
	}

	@Test
	void recognizesActiveCareReceiverConstraintByName() {
		DataIntegrityViolationException exception = withConstraintName(ACTIVE_CARE_RECEIVER_INDEX);

		assertThat(translator.isActiveCareReceiver(exception)).isTrue();
		assertThat(translator.isPendingJoinRequest(exception)).isFalse();
	}

	@Test
	void rejectsUnrelatedConstraint() {
		DataIntegrityViolationException exception = withConstraintName("uq_group_members_group_user");

		assertThat(translator.isPendingJoinRequest(exception)).isFalse();
		assertThat(translator.isActiveCareReceiver(exception)).isFalse();
	}

	/**
	 * 제약 이름이 추출되지 않는 드라이버 경로에서는 원인 메시지에 인용된 이름으로 판별한다.
	 */
	@Test
	void fallsBackToQuotedNameInCauseMessage() {
		DataIntegrityViolationException exception = new DataIntegrityViolationException(
			"could not execute statement",
			new SQLException("ERROR: duplicate key value violates unique constraint \""
				+ ACTIVE_CARE_RECEIVER_INDEX + "\""));

		assertThat(translator.isActiveCareReceiver(exception)).isTrue();
		assertThat(translator.isPendingJoinRequest(exception)).isFalse();
	}

	/**
	 * 인용되지 않은 언급은 위반한 제약을 특정하지 못하므로 변환 대상이 아니다.
	 */
	@Test
	void rejectsUnquotedNameInCauseMessage() {
		DataIntegrityViolationException exception = new DataIntegrityViolationException(
			"index " + ACTIVE_CARE_RECEIVER_INDEX + " was rebuilt");

		assertThat(translator.isActiveCareReceiver(exception)).isFalse();
		assertThat(translator.isPendingJoinRequest(exception)).isFalse();
	}

	@Test
	void rejectsViolationWithoutAnyConstraintInformation() {
		DataIntegrityViolationException exception = new DataIntegrityViolationException("could not execute statement");

		assertThat(translator.isPendingJoinRequest(exception)).isFalse();
		assertThat(translator.isActiveCareReceiver(exception)).isFalse();
	}

	private DataIntegrityViolationException withConstraintName(String constraintName) {
		SQLException cause = new SQLException("duplicate key value violates unique constraint", "23505");
		return new DataIntegrityViolationException(
			"could not execute statement",
			new ConstraintViolationException("could not execute statement", cause, constraintName));
	}
}
