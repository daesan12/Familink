package com.ssafy.s15p11b104.domain.notification.entity;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.global.entity.UpdatedAtEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "notification_settings")
public class NotificationSetting extends UpdatedAtEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(name = "notification_type", nullable = false, columnDefinition = "notification_type")
	private NotificationType notificationType;

	@Column(name = "is_enabled", nullable = false)
	private boolean enabled = true;

	protected NotificationSetting() {
	}

	public NotificationSetting(User user, NotificationType notificationType) {
		this.user = user;
		this.notificationType = notificationType;
	}

	public User getUser() {
		return user;
	}

	public NotificationType getNotificationType() {
		return notificationType;
	}

	public boolean isEnabled() {
		return enabled;
	}
}
