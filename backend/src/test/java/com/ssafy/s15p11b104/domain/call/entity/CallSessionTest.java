package com.ssafy.s15p11b104.domain.call.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

class CallSessionTest {

	@Test
	void transitionsConnectingCallToInProgressAndCompleted() {
		CallSession session = createSession();
		Instant connectedAt = Instant.parse("2026-07-28T01:00:00Z");
		Instant endedAt = Instant.parse("2026-07-28T01:10:00Z");

		session.markConnected(connectedAt);
		session.endByUser(endedAt);

		assertThat(session.getStatus()).isEqualTo(CallStatus.COMPLETED);
		assertThat(session.getStartedAt()).isEqualTo(connectedAt);
		assertThat(session.getEndedAt()).isEqualTo(endedAt);
	}

	@Test
	void cancelsConnectingCallAndKeepsDuplicateEndIdempotent() {
		CallSession session = createSession();
		Instant endedAt = Instant.parse("2026-07-28T01:00:00Z");

		session.endByUser(endedAt);
		session.endByUser(endedAt.plusSeconds(1));

		assertThat(session.getStatus()).isEqualTo(CallStatus.CANCELLED);
		assertThat(session.getEndedAt()).isEqualTo(endedAt);
	}

	@Test
	void marksUnexpectedDisconnectAccordingToCurrentState() {
		CallSession connecting = createSession();
		CallSession inProgress = createSession();
		inProgress.markConnected(Instant.parse("2026-07-28T01:00:00Z"));

		connecting.markUnexpectedDisconnect(Instant.parse("2026-07-28T01:01:00Z"));
		inProgress.markUnexpectedDisconnect(Instant.parse("2026-07-28T01:02:00Z"));

		assertThat(connecting.getStatus()).isEqualTo(CallStatus.FAILED);
		assertThat(inProgress.getStatus()).isEqualTo(CallStatus.INCOMPLETE);
	}

	@Test
	void rejectsConnectedTransitionFromTerminalState() {
		CallSession session = createSession();
		session.markConnectionFailed(Instant.parse("2026-07-28T01:00:00Z"));

		assertThatThrownBy(() -> session.markConnected(Instant.parse("2026-07-28T01:01:00Z")))
			.isInstanceOf(IllegalStateException.class);
	}

	private CallSession createSession() {
		FamilyGroup group = new FamilyGroup("가족", "ABC123");
		User user = new User("care-user", "password", "수호", LocalDate.of(1952, 4, 18), UserGender.MALE);
		GroupMember member = new GroupMember(group, user, GroupRole.CARE_RECEIVER, false, Instant.EPOCH);
		return new CallSession(group, member, 1L, CallStatus.CONNECTING);
	}
}
