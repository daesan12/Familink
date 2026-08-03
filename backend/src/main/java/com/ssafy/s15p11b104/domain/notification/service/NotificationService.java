package com.ssafy.s15p11b104.domain.notification.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.domain.account.repository.UserRepository;
import com.ssafy.s15p11b104.domain.file.service.MediaDownloadUrlProvider;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationListResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationReadAllResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationReadResponse;
import com.ssafy.s15p11b104.domain.notification.dto.NotificationUnreadCountResponse;
import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
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

		return new NotificationListResponse.Item(
			notification.getId(),
			notification.getType(),
			notification.getTitle(),
			notification.getBody(),
			idOf(notification.getGroup()),
			actorResponse,
			idOf(notification.getRelatedJoinRequest()),
			idOf(notification.getRelatedPost()),
			idOf(notification.getRelatedEvent()),
			idOf(notification.getRelatedCallReport()),
			idOf(notification.getRelatedDailyReport()),
			notification.getReadAt(),
			notification.getCreatedAt());
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
