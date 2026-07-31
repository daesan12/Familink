package com.ssafy.s15p11b104.global.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

@MappedSuperclass
public abstract class BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	@Column(name = "updated_at", nullable = false)
	private Instant updatedAt;

	@PrePersist
	void onCreate() {
		Instant now = Instant.now();
		createdAt = now;
		updatedAt = now;
	}

	@PreUpdate
	void onUpdate() {
		updatedAt = Instant.now();
	}

	/**
	 * 엔티티를 변경된 것으로 표시해 {@code updated_at}이 갱신되게 한다.
	 *
	 * <p>연관 테이블만 바뀌어 본체 필드가 그대로면 더티 체킹이 UPDATE를 생략하고 {@link #onUpdate()}도
	 * 실행되지 않는다. 그런 변경도 수정 시각에 반영해야 할 때 호출한다.
	 */
	protected void touch() {
		updatedAt = Instant.now();
	}

	public Long getId() {
		return id;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}
}
