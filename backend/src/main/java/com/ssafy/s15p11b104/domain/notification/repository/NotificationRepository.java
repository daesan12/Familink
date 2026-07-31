package com.ssafy.s15p11b104.domain.notification.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.notification.entity.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	long countByReceiver_IdAndReadAtIsNull(Long receiverId);

	@EntityGraph(attributePaths = "actor")
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
}
