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

	/**
	 * 전달된 값만 프로필에 반영한다.
	 *
	 * <p>{@code null}은 "변경하지 않음"을 뜻한다. 프로필 이미지는 삭제 요청과 미전달을 구분해야
	 * 하므로 {@link #updateProfileImageUrl(String)}에서 따로 처리한다.
	 *
	 * @param loginId   새 로그인 ID. 변경하지 않으면 {@code null}
	 * @param name      새 이름. 변경하지 않으면 {@code null}
	 * @param birthDate 새 생년월일. 변경하지 않으면 {@code null}
	 * @param gender    새 성별. 변경하지 않으면 {@code null}
	 */
	public void updateProfile(String loginId, String name, LocalDate birthDate, UserGender gender) {
		if (loginId != null) {
			this.loginId = loginId;
		}
		if (name != null) {
			this.name = name;
		}
		if (birthDate != null) {
			this.birthDate = birthDate;
		}
		if (gender != null) {
			this.gender = gender;
		}
	}

	/**
	 * 프로필 이미지를 설정하거나 삭제한다.
	 *
	 * @param profileImageUrl 새 이미지 주소. {@code null}이면 기존 이미지를 삭제한다
	 */
	public void updateProfileImageUrl(String profileImageUrl) {
		this.profileImageUrl = profileImageUrl;
	}

	/**
	 * 탈퇴 시각을 기록하고 개인정보를 익명화한다.
	 *
	 * <p>행을 삭제하지 않으므로 이 사용자가 남긴 게시글·댓글과 과거 그룹 관계는 그대로 보존된다.
	 * 로그인 수단인 {@code loginId}와 {@code passwordHash}도 지워 재로그인할 수 없게 한다.
	 *
	 * @param withdrawnAt 탈퇴 시각
	 */
	public void withdraw(Instant withdrawnAt) {
		this.loginId = null;
		this.passwordHash = null;
		this.name = null;
		this.birthDate = null;
		this.gender = null;
		this.profileImageUrl = null;
		this.withdrawnAt = withdrawnAt;
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
