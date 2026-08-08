package com.ssafy.s15p11b104.domain.notification.service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.feed.entity.Comment;
import com.ssafy.s15p11b104.domain.feed.entity.Post;
import com.ssafy.s15p11b104.domain.feed.entity.PostReaction;
import com.ssafy.s15p11b104.domain.feed.repository.CommentRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostReactionRepository;
import com.ssafy.s15p11b104.domain.feed.repository.PostRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupJoinRequestRepository;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationCreationStore.Command;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.repository.DailyReportRepository;

@Service
public class DomainNotificationRoutingService {

	private static final Logger LOGGER = LoggerFactory.getLogger(DomainNotificationRoutingService.class);

	private final GroupJoinRequestRepository groupJoinRequestRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final MemberAliasRepository memberAliasRepository;
	private final PostRepository postRepository;
	private final CommentRepository commentRepository;
	private final PostReactionRepository postReactionRepository;
	private final CallReportCallRepository callReportRepository;
	private final DailyReportRepository dailyReportRepository;
	private final NotificationCreationService notificationCreationService;

	public DomainNotificationRoutingService(
		GroupJoinRequestRepository groupJoinRequestRepository,
		GroupMemberRepository groupMemberRepository,
		MemberAliasRepository memberAliasRepository,
		PostRepository postRepository,
		CommentRepository commentRepository,
		PostReactionRepository postReactionRepository,
		CallReportCallRepository callReportRepository,
		DailyReportRepository dailyReportRepository,
		NotificationCreationService notificationCreationService
	) {
		this.groupJoinRequestRepository = groupJoinRequestRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.memberAliasRepository = memberAliasRepository;
		this.postRepository = postRepository;
		this.commentRepository = commentRepository;
		this.postReactionRepository = postReactionRepository;
		this.callReportRepository = callReportRepository;
		this.dailyReportRepository = dailyReportRepository;
		this.notificationCreationService = notificationCreationService;
	}

	@EventListener
	public void route(DomainNotificationEvent event) {
		switch (event) {
			case DomainNotificationEvent.JoinRequestCreated created -> routeJoinRequestCreated(created);
			case DomainNotificationEvent.JoinRequestDecided decided -> routeJoinRequestDecided(decided);
			case DomainNotificationEvent.PostCreated created -> routePostCreated(created);
			case DomainNotificationEvent.CommentCreated created -> routeCommentCreated(created);
			case DomainNotificationEvent.ReactionCreated created -> routeReactionCreated(created);
			case DomainNotificationEvent.CalendarChanged changed -> routeCalendarChanged(changed);
			case DomainNotificationEvent.CallReportCreated created -> routeCallReportCreated(created);
			case DomainNotificationEvent.DailyReportCreated created -> routeDailyReportCreated(created);
		}
	}

	private void routeJoinRequestCreated(DomainNotificationEvent.JoinRequestCreated event) {
		GroupJoinRequest joinRequest = groupJoinRequestRepository.findById(event.joinRequestId()).orElse(null);
		if (joinRequest == null || !hasText(joinRequest.getApplicant().getName())
			|| !hasText(joinRequest.getGroup().getName())) {
			logMissingData("JOIN_REQUEST_CREATED", event.joinRequestId());
			return;
		}

		String body = "%s님이 %s 그룹 가입을 요청했어요."
			.formatted(joinRequest.getApplicant().getName(), joinRequest.getGroup().getName());
		String sourceEventKey = sourceKey("JOIN_REQUEST", joinRequest.getId(), "CREATED");
		groupMemberRepository.findAllActiveByGroupId(joinRequest.getGroup().getId()).stream()
			.filter(GroupMember::isManager)
			.forEach(receiver -> persist(new Command(
				receiver.getUser().getId(),
				joinRequest.getApplicant().getId(),
				joinRequest.getGroup().getId(),
				joinRequest.getId(),
				null,
				null,
				null,
				null,
				NotificationType.GROUP_JOIN_REQUEST,
				null,
				"새 가입 요청이 있어요",
				body,
				sourceEventKey)));
	}

	private void routeJoinRequestDecided(DomainNotificationEvent.JoinRequestDecided event) {
		GroupJoinRequest joinRequest = groupJoinRequestRepository.findById(event.joinRequestId()).orElse(null);
		if (joinRequest == null || !hasText(joinRequest.getGroup().getName())) {
			logMissingData("JOIN_REQUEST_DECIDED", event.joinRequestId());
			return;
		}

		boolean approved = event.decision() == DomainNotificationEvent.Decision.APPROVED;
		String action = approved ? "APPROVED" : "REJECTED";
		String title = approved ? "가입 요청이 승인됐어요" : "가입 요청이 거절됐어요";
		String body = approved
			? "%s 그룹에 가입됐어요.".formatted(joinRequest.getGroup().getName())
			: "%s 그룹 가입 요청이 거절됐어요.".formatted(joinRequest.getGroup().getName());
		persist(new Command(
			joinRequest.getApplicant().getId(),
			event.actorUserId(),
			joinRequest.getGroup().getId(),
			joinRequest.getId(),
			null,
			null,
			null,
			null,
			NotificationType.GROUP_JOIN_REQUEST,
			null,
			title,
			body,
			sourceKey("JOIN_REQUEST", joinRequest.getId(), action)));
	}

	private void routePostCreated(DomainNotificationEvent.PostCreated event) {
		Post post = postRepository.findWithAuthorAndGroupById(event.postId()).orElse(null);
		if (post == null) {
			logMissingData("POST_CREATED", event.postId());
			return;
		}

		GroupMember author = post.getAuthorMember();
		String sourceEventKey = sourceKey("POST", post.getId(), "CREATED");
		groupMemberRepository.findAllActiveByGroupId(post.getGroup().getId()).stream()
			.filter(receiver -> !receiver.getId().equals(author.getId()))
			.forEach(receiver -> {
				String displayName = displayName(receiver, author);
				if (!hasText(displayName)) {
					logMissingData("POST_CREATED", post.getId());
					return;
				}
				persist(new Command(
					receiver.getUser().getId(),
					author.getUser().getId(),
					post.getGroup().getId(),
					null,
					post.getId(),
					null,
					null,
					null,
					NotificationType.NEW_POST,
					null,
					"새 게시글이 올라왔어요",
					"%s님이 새 게시글을 올렸어요.".formatted(displayName),
					sourceEventKey));
			});
	}

	private void routeCommentCreated(DomainNotificationEvent.CommentCreated event) {
		Comment comment = commentRepository.findById(event.commentId()).orElse(null);
		if (comment == null) {
			logMissingData("COMMENT_CREATED", event.commentId());
			return;
		}
		routePostActivity(
			comment.getPost(),
			comment.getAuthorMember(),
			comment.getId(),
			"COMMENT",
			"게시글에 새 댓글이 달렸어요",
			"님이 회원님의 게시글에 댓글을 남겼어요.");
	}

	private void routeReactionCreated(DomainNotificationEvent.ReactionCreated event) {
		PostReaction reaction = postReactionRepository.findById(event.reactionId()).orElse(null);
		if (reaction == null) {
			logMissingData("REACTION_CREATED", event.reactionId());
			return;
		}
		routePostActivity(
			reaction.getPost(),
			reaction.getGroupMember(),
			reaction.getId(),
			"REACTION",
			"게시글에 새 반응이 생겼어요",
			"님이 회원님의 게시글에 반응했어요.");
	}

	private void routePostActivity(
		Post post,
		GroupMember actor,
		Long sourceId,
		String sourceDomain,
		String title,
		String bodySuffix
	) {
		GroupMember receiver = post.getAuthorMember();
		if (receiver.getId().equals(actor.getId()) || !receiver.isActive()) {
			return;
		}
		String displayName = displayName(receiver, actor);
		if (!hasText(displayName)) {
			logMissingData(sourceDomain + "_CREATED", sourceId);
			return;
		}

		persist(new Command(
			receiver.getUser().getId(),
			actor.getUser().getId(),
			post.getGroup().getId(),
			null,
			post.getId(),
			null,
			null,
			null,
			NotificationType.POST_ACTIVITY,
			null,
			title,
			displayName + bodySuffix,
			sourceKey(sourceDomain, sourceId, "CREATED")));
	}

	private void routeCalendarChanged(DomainNotificationEvent.CalendarChanged event) {
		if (!hasText(event.title())) {
			logMissingData("EVENT_" + event.action(), event.eventId());
			return;
		}

		Set<Long> requestedMemberIds = new LinkedHashSet<>();
		requestedMemberIds.addAll(event.beforeParticipantMemberIds());
		requestedMemberIds.addAll(event.afterParticipantMemberIds());
		if (requestedMemberIds.isEmpty()) {
			return;
		}
		List<GroupMember> activeMembers = groupMemberRepository.findAllActiveByGroupId(event.groupId());
		List<GroupMember> receivers = activeMembers.stream()
			.filter(member -> requestedMemberIds.contains(member.getId()))
			.toList();

		CalendarMessage message = switch (event.action()) {
			case CREATED -> new CalendarMessage(
				"새 일정이 등록됐어요",
				"\"%s\" 일정이 등록됐어요.".formatted(event.title()),
				sourceKey("EVENT", event.eventId(), "CREATED"));
			case UPDATED -> new CalendarMessage(
				"일정이 변경됐어요",
				"\"%s\" 일정이 변경됐어요.".formatted(event.title()),
				changedEventSourceKey(event, "UPDATED"));
			case DELETED -> new CalendarMessage(
				"일정이 삭제됐어요",
				"\"%s\" 일정이 삭제됐어요.".formatted(event.title()),
				changedEventSourceKey(event, "DELETED"));
		};

		receivers.stream()
			.filter(receiver -> !receiver.getId().equals(event.actorMemberId()))
			.forEach(receiver -> persist(new Command(
				receiver.getUser().getId(),
				actorUserId(activeMembers, event.actorMemberId()),
				event.groupId(),
				null,
				null,
				event.eventId(),
				null,
				null,
				NotificationType.EVENT_CHANGED,
				null,
				message.title(),
				message.body(),
				message.sourceEventKey())));
	}

	private void routeCallReportCreated(DomainNotificationEvent.CallReportCreated event) {
		CallReport report = callReportRepository.findById(event.callReportId()).orElse(null);
		if (report == null) {
			logMissingData("CALL_REPORT_CREATED", event.callReportId());
			return;
		}
		GroupMember careReceiver = report.getCallSession().getCareReceiverMember();
		routeReport(
			careReceiver,
			report.getCallSession().getGroup().getId(),
			report.getId(),
			NotificationType.CALL_REPORT,
			"통화 리포트가 준비됐어요",
			"님의 통화 리포트를 확인해 보세요.");
	}

	private void routeDailyReportCreated(DomainNotificationEvent.DailyReportCreated event) {
		DailyReport report = dailyReportRepository.findById(event.dailyReportId()).orElse(null);
		if (report == null) {
			logMissingData("DAILY_REPORT_CREATED", event.dailyReportId());
			return;
		}
		routeReport(
			report.getCareReceiverMember(),
			report.getGroup().getId(),
			report.getId(),
			NotificationType.DAILY_REPORT,
			"오늘의 리포트가 준비됐어요",
			"님의 오늘 리포트를 확인해 보세요.");
	}

	private void routeReport(
		GroupMember careReceiver,
		Long groupId,
		Long reportId,
		NotificationType type,
		String title,
		String bodySuffix
	) {
		String domain = type == NotificationType.CALL_REPORT ? "CALL_REPORT" : "DAILY_REPORT";
		groupMemberRepository.findAllActiveByGroupId(groupId).stream()
			.filter(member -> member.getRole() == GroupRole.GUARDIAN)
			.forEach(receiver -> {
				String displayName = displayName(receiver, careReceiver);
				if (!hasText(displayName)) {
					logMissingData(domain + "_CREATED", reportId);
					return;
				}
				persist(new Command(
					receiver.getUser().getId(),
					null,
					groupId,
					null,
					null,
					null,
					type == NotificationType.CALL_REPORT ? reportId : null,
					type == NotificationType.DAILY_REPORT ? reportId : null,
					type,
					null,
					title,
					displayName + bodySuffix,
					sourceKey(domain, reportId, "CREATED")));
			});
	}

	private void persist(Command command) {
		notificationCreationService.create(command);
	}

	private String displayName(GroupMember receiver, GroupMember target) {
		return memberAliasRepository
			.findByGroupIdAndOwnerMemberIdAndTargetMemberId(
				receiver.getGroup().getId(), receiver.getId(), target.getId())
			.map(alias -> alias.getAlias())
			.orElse(target.getUser().getName());
	}

	private Long actorUserId(List<GroupMember> activeMembers, Long actorMemberId) {
		return activeMembers.stream()
			.filter(member -> member.getId().equals(actorMemberId))
			.map(member -> member.getUser().getId())
			.findFirst()
			.orElse(null);
	}

	private String changedEventSourceKey(DomainNotificationEvent.CalendarChanged event, String action) {
		return "%s:%s".formatted(sourceKey("EVENT", event.eventId(), action), event.changeId());
	}

	private String sourceKey(String domain, Long sourceId, String action) {
		return "%s:%d:%s".formatted(domain, sourceId, action);
	}

	private boolean hasText(String value) {
		return StringUtils.hasText(value);
	}

	private void logMissingData(String eventType, Long sourceId) {
		LOGGER.error("알림 사건 필수 데이터가 없습니다. eventType={}, sourceId={}", eventType, sourceId);
	}

	private record CalendarMessage(String title, String body, String sourceEventKey) {
	}
}
