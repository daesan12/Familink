package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallSession;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.group.entity.GroupJoinRequest;
import com.ssafy.s15p11b104.domain.group.entity.JoinRequestStatus;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationListResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationReadAllResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationReadResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationUnreadCountResponse;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
import com.ssafy.s15p11b104.domain.report.entity.DailyReport;
import com.ssafy.s15p11b104.domain.report.service.DailyReportWindow;
import com.ssafy.s15p11b104.global.entity.BaseEntity;
import com.ssafy.s15p11b104.global.entity.CreatedAtEntity;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class NotificationService {

	private static final Sort LATEST_FIRST = Sort.by(
		Sort.Order.desc("createdAt"),
		Sort.Order.desc("id"));

	private final UserRepository userRepository;
	private final NotificationRepository notificationRepository;
	private final MediaDownloadUrlProvider mediaDownloadUrlProvider;

	public NotificationService(
		UserRepository userRepository,
		NotificationRepository notificationRepository,
		MediaDownloadUrlProvider mediaDownloadUrlProvider
	) {
		this.userRepository = userRepository;
		this.notificationRepository = notificationRepository;
		this.mediaDownloadUrlProvider = mediaDownloadUrlProvider;
	}

	@Transactional(readOnly = true)
	public NotificationUnreadCountResponse getUnreadCount(Long userId) {
		requireActiveUser(userId);
		return new NotificationUnreadCountResponse(
			notificationRepository.countByReceiver_IdAndReadAtIsNull(userId));
	}

	@Transactional(readOnly = true)
	public NotificationListResponse getNotifications(Long userId, int page, int size) {
		requireActiveUser(userId);
		Page<Notification> notifications = notificationRepository.findPageByReceiverId(
			userId,
			PageRequest.of(page, size, LATEST_FIRST));

		return new NotificationListResponse(
			notifications.getContent().stream().map(this::toItem).toList(),
			notifications.hasNext());
	}

	@Transactional
	public NotificationReadResponse markRead(Long userId, Long notificationId) {
		requireActiveUser(userId);
		Notification notification = notificationRepository
			.findByIdAndReceiver_Id(notificationId, userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
		notification.markRead(Instant.now().truncatedTo(ChronoUnit.MICROS));
		return new NotificationReadResponse(notification.getId(), notification.getReadAt());
	}

	@Transactional
	public NotificationReadAllResponse markAllRead(Long userId) {
		requireActiveUser(userId);
		Instant readAt = Instant.now().truncatedTo(ChronoUnit.MICROS);
		int updatedCount = notificationRepository.markAllRead(userId, readAt);
		return new NotificationReadAllResponse(updatedCount, readAt);
	}

	private NotificationListResponse.Item toItem(Notification notification) {
		User actor = notification.getActor();
		NotificationListResponse.Actor actorResponse = actor == null
			? null
			: new NotificationListResponse.Actor(
				actor.getId(),
				actor.getName(),
				mediaDownloadUrlProvider.issueProfileImageDownloadUrl(actor.getProfileImageUrl()));

		ReportRouting reportRouting = reportRoutingOf(notification);
		return new NotificationListResponse.Item(
			notification.getId(),
			notification.getType(),
			notification.getTitle(),
			notification.getBody(),
			idOf(notification.getGroup()),
			actorResponse,
			idOf(notification.getRelatedJoinRequest()),
			statusOf(notification),
			idOf(notification.getRelatedPost()),
			idOf(notification.getRelatedEvent()),
			idOf(notification.getRelatedCallReport()),
			idOf(notification.getRelatedDailyReport()),
			reportRouting.callSessionId(),
			reportRouting.careReceiverMemberId(),
			reportRouting.reportDate(),
			notification.getReadAt(),
			notification.getCreatedAt());
	}

	/**
	 * 리포트 알림 탭 이동에 필요한 조회 키를 채운다.
	 *
	 * <p>리포트 조회 API의 경로 파라미터는 callSessionId 또는 날짜·멤버 조합이라
	 * relatedCallReportId·relatedDailyReportId만으로는 상세 화면을 열 수 없다.
	 */
	private ReportRouting reportRoutingOf(Notification notification) {
		if (notification.getType() == NotificationType.CALL_REPORT) {
			CallReport callReport = notification.getRelatedCallReport();
			if (callReport == null) {
				return ReportRouting.EMPTY;
			}
			CallSession callSession = callReport.getCallSession();
			Instant endedAt = callSession.getEndedAt();
			return new ReportRouting(
				callSession.getId(),
				callSession.getCareReceiverMember().getId(),
				endedAt == null ? null : DailyReportWindow.reportDateForEndedAt(endedAt));
		}
		if (notification.getType() == NotificationType.DAILY_REPORT) {
			DailyReport dailyReport = notification.getRelatedDailyReport();
			if (dailyReport == null) {
				return ReportRouting.EMPTY;
			}
			return new ReportRouting(
				null,
				dailyReport.getCareReceiverMember().getId(),
				dailyReport.getReportDate());
		}
		return ReportRouting.EMPTY;
	}

	private record ReportRouting(Long callSessionId, Long careReceiverMemberId, LocalDate reportDate) {

		private static final ReportRouting EMPTY = new ReportRouting(null, null, null);
	}

	private JoinRequestStatus statusOf(Notification notification) {
		if (notification.getType() != NotificationType.GROUP_JOIN_REQUEST) {
			return null;
		}
		GroupJoinRequest joinRequest = notification.getRelatedJoinRequest();
		return joinRequest == null ? null : joinRequest.getStatus();
	}

	private Long idOf(BaseEntity entity) {
		return entity == null ? null : entity.getId();
	}

	private Long idOf(CreatedAtEntity entity) {
		return entity == null ? null : entity.getId();
	}

	private void requireActiveUser(Long userId) {
		userRepository.findByIdAndWithdrawnAtIsNull(userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
	}
}
