package com.ssafy.s15p11b104.domain.notification.entity;

import com.ssafy.s15p11b104.domain.account.entity.User;
import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "device_tokens")
public class DeviceToken extends BaseEntity {

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false, unique = true, length = 500)
	private String token;

	@Column(name = "device_type", nullable = false, length = 20)
	private String deviceType;

	@Column(name = "is_active", nullable = false)
	private boolean active = true;

	protected DeviceToken() {
	}

	public DeviceToken(User user, String token, String deviceType) {
		this.user = user;
		this.token = token;
		this.deviceType = deviceType;
	}

	public User getUser() {
		return user;
	}

	public String getToken() {
		return token;
	}

	public String getDeviceType() {
		return deviceType;
	}

	public boolean isActive() {
		return active;
	}

	public void deactivate() {
		if (active) {
			active = false;
			touch();
		}
	}
}
