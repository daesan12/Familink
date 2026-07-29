package com.ssafy.s15p11b104.domain.account.dto;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.ssafy.s15p11b104.domain.account.entity.UserGender;

import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 본인 프로필 수정 요청이다.
 *
 * <p>부분 수정이므로 변경할 필드만 담는다. 전달되지 않은 필드는 기존 값을 유지한다. 값이 있으면
 * 회원가입과 같은 형식 조건을 적용해, 회원가입은 거부되지만 수정은 통과하는 값이 생기지 않게 한다.
 *
 * <p>{@code profileImageUrl}은 {@code null}을 "기존 이미지 삭제"로 해석해야 하므로 다른 필드와 달리
 * 전달 여부를 따로 기록한다. 레코드로는 필드 미전달과 명시적 {@code null}을 구분할 수 없어 일반
 * 클래스로 둔다.
 */
public class ProfileUpdateRequest {

	@JsonProperty
	@Size(min = 5, max = 15)
	@Pattern(regexp = "\\S+")
	private String loginId;

	/** 공백만으로 이루어진 이름을 거부한다. 회원가입의 {@code @NotBlank}와 같은 조건이다. */
	@JsonProperty
	@Size(min = 2, max = 10)
	@Pattern(regexp = ".*\\S.*")
	private String name;

	@JsonProperty
	@Past
	private LocalDate birthDate;

	@JsonProperty
	private UserGender gender;

	/**
	 * 이미지 삭제는 {@code null}로만 요청한다. 빈 문자열을 저장하면 조회 응답이 {@code null}이 아닌
	 * 빈 주소를 돌려주어, 이미지 유무를 {@code null}로 판단하는 클라이언트가 빈 주소를 로드한다.
	 */
	@Size(max = 500)
	@Pattern(regexp = ".*\\S.*")
	private String profileImageUrl;

	private boolean profileImageUrlProvided;

	/**
	 * Jackson은 JSON에 키가 있을 때만 이 setter를 호출한다. 따라서 명시적 {@code null} 전달과 필드
	 * 미전달을 구분할 수 있다.
	 *
	 * @param profileImageUrl 전달된 프로필 이미지 주소. 삭제 요청이면 {@code null}
	 */
	@JsonSetter("profileImageUrl")
	void setProfileImageUrl(String profileImageUrl) {
		this.profileImageUrl = profileImageUrl;
		this.profileImageUrlProvided = true;
	}

	public String loginId() {
		return loginId;
	}

	public String name() {
		return name;
	}

	public LocalDate birthDate() {
		return birthDate;
	}

	public UserGender gender() {
		return gender;
	}

	public String profileImageUrl() {
		return profileImageUrl;
	}

	public boolean profileImageUrlProvided() {
		return profileImageUrlProvided;
	}
}
