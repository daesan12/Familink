package com.ssafy.s15p11b104.domain.account.dto;

import java.time.LocalDate;

import com.ssafy.s15p11b104.domain.account.entity.UserGender;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * 회원가입 요청이다.
 *
 * <p>비밀번호 확인 값은 클라이언트에서 검증하므로 전달받지 않는다.
 *
 * @param loginId   로그인 ID. 공백을 포함하면 육안으로 구별되지 않는 계정이 생기므로 허용하지 않는다.
 * @param password  원문 비밀번호이며 해시만 저장한다.
 * @param name      사용자 이름
 * @param birthDate 생년월일
 * @param gender    성별
 */
public record SignupRequest(
	@NotBlank @Size(min = 5, max = 15) @Pattern(regexp = "\\S+") String loginId,
	@NotBlank @Size(min = 8, max = 16) String password,
	@NotBlank @Size(min = 2, max = 10) String name,
	@NotNull @Past LocalDate birthDate,
	@NotNull UserGender gender
) {
}
