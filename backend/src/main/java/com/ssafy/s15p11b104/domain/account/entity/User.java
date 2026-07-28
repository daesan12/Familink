package com.ssafy.s15p11b104.domain.account.entity;

import java.time.Instant;
import java.time.LocalDate;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.ssafy.s15p11b104.global.entity.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

	@Column(name = "login_id", length = 15, unique = true)
	private String loginId;

	@Column(name = "password_hash", length = 255)
	private String passwordHash;

	@Column(length = 10)
	private String name;

	@Column(name = "birth_date")
	private LocalDate birthDate;

	@Enumerated(EnumType.STRING)
	@JdbcTypeCode(SqlTypes.NAMED_ENUM)
	@Column(columnDefinition = "user_gender")
	private UserGender gender;

	@Column(name = "profile_image_url", length = 500)
	private String profileImageUrl;

	@Column(name = "withdrawn_at")
	private Instant withdrawnAt;

	protected User() {
	}

	public User(String loginId, String passwordHash, String name, LocalDate birthDate, UserGender gender) {
		this.loginId = loginId;
		this.passwordHash = passwordHash;
		this.name = name;
		this.birthDate = birthDate;
		this.gender = gender;
	}

	public String getLoginId() {
		return loginId;
	}

	public String getPasswordHash() {
		return passwordHash;
	}

	public String getName() {
		return name;
	}

	public LocalDate getBirthDate() {
		return birthDate;
	}

	public UserGender getGender() {
		return gender;
	}

	public String getProfileImageUrl() {
		return profileImageUrl;
	}

	public Instant getWithdrawnAt() {
		return withdrawnAt;
	}
}
