package com.ssafy.s15p11b104.domain.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Comment;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.FamilyGroup;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore.Command;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@ExtendWith(MockitoExtension.class)
class DomainNotificationRoutingServiceTest {

	@Mock
	private GroupJoinRequestRepository groupJoinRequestRepository;

	@Mock
	private GroupMemberRepository groupMemberRepository;

	@Mock
	private MemberAliasRepository memberAliasRepository;

	@Mock
	private PostRepository postRepository;

	@Mock
	private CommentRepository commentRepository;

	@Mock
	private PostReactionRepository postReactionRepository;

	@Mock
	private CallReportCallRepository callReportRepository;

	@Mock
	private DailyReportRepository dailyReportRepository;

	@Mock
	private NotificationCreationService notificationCreationService;

	@InjectMocks
	private DomainNotificationRoutingService routingService;

	@Test
	void routesJoinRequestCreationToActiveManagersOnly() {
		FamilyGroup group = group(10L, "우리 가족");
		GroupMember manager = member(11L, 101L, group, GroupRole.GUARDIAN, true, "관리자");
		GroupMember regular = member(12L, 102L, group, GroupRole.GUARDIAN, false, "구성원");
		User applicant = user(103L, "신청자");
		GroupJoinRequest joinRequest = mock(GroupJoinRequest.class);
		when(joinRequest.getId()).thenReturn(20L);
		when(joinRequest.getGroup()).thenReturn(group);
		when(joinRequest.getApplicant()).thenReturn(applicant);
		when(groupJoinRequestRepository.findById(20L)).thenReturn(Optional.of(joinRequest));
		when(groupMemberRepository.findAllActiveByGroupId(10L)).thenReturn(List.of(manager, regular));

		routingService.route(new DomainNotificationEvent.JoinRequestCreated(20L));

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService).create(captor.capture());
		assertThat(captor.getValue().receiverUserId()).isEqualTo(101L);
		assertThat(captor.getValue().actorUserId()).isEqualTo(103L);
		assertThat(captor.getValue().sourceEventKey()).isEqualTo("JOIN_REQUEST:20:CREATED");
		assertThat(captor.getValue().body()).isEqualTo("신청자님이 우리 가족 그룹 가입을 요청했어요.");
	}

	@Test
	void routesJoinRequestApprovalAndRejectionToTheApplicantWithTheSameRelation() {
		FamilyGroup group = group(10L, "우리 가족");
		User applicant = user(103L, "신청자");
		GroupJoinRequest joinRequest = mock(GroupJoinRequest.class);
		when(joinRequest.getId()).thenReturn(20L);
		when(joinRequest.getGroup()).thenReturn(group);
		when(joinRequest.getApplicant()).thenReturn(applicant);
		when(groupJoinRequestRepository.findById(20L)).thenReturn(Optional.of(joinRequest));

		routingService.route(new DomainNotificationEvent.JoinRequestDecided(
			20L,
			101L,
			DomainNotificationEvent.Decision.APPROVED));
		routingService.route(new DomainNotificationEvent.JoinRequestDecided(
			20L,
			101L,
			DomainNotificationEvent.Decision.REJECTED));

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService, org.mockito.Mockito.times(2)).create(captor.capture());
		assertThat(captor.getAllValues())
			.extracting(Command::receiverUserId)
			.containsOnly(103L);
		assertThat(captor.getAllValues())
			.extracting(Command::relatedJoinRequestId)
			.containsOnly(20L);
		assertThat(captor.getAllValues())
			.extracting(Command::type)
			.containsOnly(NotificationType.GROUP_JOIN_REQUEST);
		assertThat(captor.getAllValues())
			.extracting(Command::sourceEventKey)
			.containsExactly(
				"JOIN_REQUEST:20:APPROVED",
				"JOIN_REQUEST:20:REJECTED");
	}

	@Test
	void routesNewPostToMembersExceptAuthorWithReceiverAlias() {
		FamilyGroup group = group(10L, "우리 가족");
		GroupMember author = member(11L, 101L, group, GroupRole.GUARDIAN, false, "홍길동");
		GroupMember receiver = member(12L, 102L, group, GroupRole.GUARDIAN, false, "수신자");
		Post post = mock(Post.class);
		when(post.getId()).thenReturn(30L);
		when(post.getGroup()).thenReturn(group);
		when(post.getAuthorMember()).thenReturn(author);
		when(postRepository.findWithAuthorAndGroupById(30L)).thenReturn(Optional.of(post));
		when(groupMemberRepository.findAllActiveByGroupId(10L)).thenReturn(List.of(author, receiver));
		when(memberAliasRepository.findByGroupIdAndOwnerMemberIdAndTargetMemberId(10L, 12L, 11L))
			.thenReturn(Optional.of(new com.ssafy.s15p11b104.domain.group.entity.MemberAlias(
				group, receiver, author, "우리 아빠")));

		routingService.route(new DomainNotificationEvent.PostCreated(30L));

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService).create(captor.capture());
		assertThat(captor.getValue().receiverUserId()).isEqualTo(102L);
		assertThat(captor.getValue().body()).isEqualTo("우리 아빠님이 새 게시글을 올렸어요.");
		assertThat(captor.getValue().sourceEventKey()).isEqualTo("POST:30:CREATED");
	}

	@Test
	void doesNotNotifyPostAuthorAboutOwnComment() {
		FamilyGroup group = group(10L, "우리 가족");
		GroupMember author = member(11L, 101L, group, GroupRole.GUARDIAN, false, "작성자");
		Post post = mock(Post.class);
		when(post.getAuthorMember()).thenReturn(author);
		Comment comment = mock(Comment.class);
		when(comment.getPost()).thenReturn(post);
		when(comment.getAuthorMember()).thenReturn(author);
		when(comment.getId()).thenReturn(40L);
		when(commentRepository.findById(40L)).thenReturn(Optional.of(comment));

		routingService.route(new DomainNotificationEvent.CommentCreated(40L));

		verifyNoInteractions(notificationCreationService);
	}

	@Test
	void routesCalendarUpdateToBeforeAfterUnionExceptEditor() {
		FamilyGroup group = group(10L, "우리 가족");
		GroupMember editor = member(11L, 101L, group, GroupRole.GUARDIAN, false, "수정자");
		GroupMember oldParticipant = member(12L, 102L, group, GroupRole.GUARDIAN, false, "기존");
		GroupMember newParticipant = member(13L, 103L, group, GroupRole.GUARDIAN, false, "신규");
		when(groupMemberRepository.findAllActiveByGroupId(10L))
			.thenReturn(List.of(editor, oldParticipant, newParticipant));

		routingService.route(new DomainNotificationEvent.CalendarChanged(
			50L,
			10L,
			11L,
			"병원 방문",
			List.of(11L, 12L),
			List.of(13L),
			DomainNotificationEvent.CalendarAction.UPDATED,
			UUID.fromString("3d3e9a40-846e-40df-b065-093366a955cf")));

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService, org.mockito.Mockito.times(2)).create(captor.capture());
		assertThat(captor.getAllValues())
			.extracting(Command::receiverUserId)
			.containsExactlyInAnyOrder(102L, 103L);
		assertThat(captor.getAllValues())
			.extracting(Command::sourceEventKey)
			.containsOnly("EVENT:50:UPDATED:3d3e9a40-846e-40df-b065-093366a955cf");
	}

	@Test
	void routesCallReportToGuardiansOnly() {
		FamilyGroup group = group(10L, "우리 가족");
		GroupMember careReceiver = member(11L, 101L, group, GroupRole.CARE_RECEIVER, false, "피보호자");
		GroupMember guardian = member(12L, 102L, group, GroupRole.GUARDIAN, false, "보호자");
		CallSession session = mock(CallSession.class);
		when(session.getGroup()).thenReturn(group);
		when(session.getCareReceiverMember()).thenReturn(careReceiver);
		CallReport report = mock(CallReport.class);
		when(report.getId()).thenReturn(60L);
		when(report.getCallSession()).thenReturn(session);
		when(callReportRepository.findById(60L)).thenReturn(Optional.of(report));
		when(groupMemberRepository.findAllActiveByGroupId(10L)).thenReturn(List.of(careReceiver, guardian));
		when(memberAliasRepository.findByGroupIdAndOwnerMemberIdAndTargetMemberId(10L, 12L, 11L))
			.thenReturn(Optional.empty());

		routingService.route(new DomainNotificationEvent.CallReportCreated(60L));

		ArgumentCaptor<Command> captor = ArgumentCaptor.forClass(Command.class);
		verify(notificationCreationService).create(captor.capture());
		assertThat(captor.getValue().receiverUserId()).isEqualTo(102L);
		assertThat(captor.getValue().type()).isEqualTo(NotificationType.CALL_REPORT);
		assertThat(captor.getValue().body()).isEqualTo("피보호자님의 통화 리포트를 확인해 보세요.");
	}

	private FamilyGroup group(Long groupId, String name) {
		FamilyGroup group = mock(FamilyGroup.class);
		lenient().when(group.getId()).thenReturn(groupId);
		lenient().when(group.getName()).thenReturn(name);
		return group;
	}

	private GroupMember member(
		Long memberId,
		Long userId,
		FamilyGroup group,
		GroupRole role,
		boolean manager,
		String name
	) {
		GroupMember member = mock(GroupMember.class);
		User user = user(userId, name);
		lenient().when(member.getId()).thenReturn(memberId);
		lenient().when(member.getUser()).thenReturn(user);
		lenient().when(member.getGroup()).thenReturn(group);
		lenient().when(member.getRole()).thenReturn(role);
		lenient().when(member.isManager()).thenReturn(manager);
		lenient().when(member.isActive()).thenReturn(true);
		return member;
	}

	private User user(Long userId, String name) {
		User user = mock(User.class);
		lenient().when(user.getId()).thenReturn(userId);
		lenient().when(user.getName()).thenReturn(name);
		return user;
	}
}
