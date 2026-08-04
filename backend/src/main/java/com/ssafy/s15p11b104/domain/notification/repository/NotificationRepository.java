package com.ssafy.s15p11b104.domain.notification.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.notification.entity.Notification;
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	long countByReceiver_IdAndReadAtIsNull(Long receiverId);

	@EntityGraph(attributePaths = {"actor", "relatedJoinRequest"})
	@Query("select notification from Notification notification where notification.receiver.id = :receiverId")
	Page<Notification> findPageByReceiverId(
		@Param("receiverId") Long receiverId,
		Pageable pageable);

	Optional<Notification> findByIdAndReceiver_Id(Long id, Long receiverId);

	@Modifying(clearAutomatically = true, flushAutomatically = true)
	@Query("""
		update Notification notification
		set notification.readAt = :readAt
		where notification.receiver.id = :receiverId and notification.readAt is null
		""")
	int markAllRead(
		@Param("receiverId") Long receiverId,
		@Param("readAt") Instant readAt);

	/**
	 * 한 일정의 특정 알림 시점에 이미 알림을 받은 수신자 ID를 조회한다.
	 *
	 * <p>스케줄러가 대상자 전체에서 이 목록을 빼 아직 받지 않은 수신자만 저장하므로
	 * {@code uq_event_reminder_notification} 위반 없이 같은 시점을 여러 번 스캔할 수 있다.
	 */
	@Query("""
		select notification.receiver.id
		from Notification notification
		where notification.relatedEvent.id = :eventId
			and notification.type = :type
			and notification.reminderSlot = :reminderSlot
		""")
	List<Long> findReceiverIdsByEventAndSlot(
		@Param("eventId") Long eventId,
		@Param("type") NotificationType type,
		@Param("reminderSlot") ReminderSlot reminderSlot);

	/**
	 * 한 일정에 연결된 특정 알림 시점의 알림을 삭제한다.
	 *
	 * <p>그 시점이 바뀌면 이미 만든 알림은 더 이상 사실이 아니므로 지우고 새 시점에 다시 생성되게
	 * 한다. 시점이 그대로인 다른 알림 시점의 알림을 함께 지우지 않도록 범위를 슬롯으로 좁힌다.
	 */
	@Modifying
	@Query("""
		delete from Notification notification
		where notification.relatedEvent.id = :eventId
			and notification.type = :type
			and notification.reminderSlot = :reminderSlot
		""")
	int deleteAllByRelatedEventIdAndTypeAndReminderSlot(
		@Param("eventId") Long eventId,
		@Param("type") NotificationType type,
		@Param("reminderSlot") ReminderSlot reminderSlot);
}
