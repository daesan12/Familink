package com.ssafy.s15p11b104.domain.account.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.ssafy.s15p11b104.domain.account.entity.UserGender;

import jakarta.validation.Validation;
import jakarta.validation.Validator;

class AccountRequestValidationTest {

	private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

	@Test
	void signupAcceptsOnlyContractLoginIdAndPasswordFormats() {
		SignupRequest valid = signupRequest("testuser", "password1");
		SignupRequest invalidLoginId = signupRequest("test!", "password1");
		SignupRequest invalidPassword = signupRequest("testuser", "password");

		assertThat(validator.validate(valid)).isEmpty();
		assertThat(validator.validate(invalidLoginId))
			.extracting(violation -> violation.getPropertyPath().toString())
			.containsExactly("loginId");
		assertThat(validator.validate(invalidPassword))
			.extracting(violation -> violation.getPropertyPath().toString())
			.containsExactly("password");
	}

	@Test
	void profileLoginIdUsesSignupFormat() {
		ProfileUpdateRequest request = new ProfileUpdateRequest();
		ReflectionTestUtils.setField(request, "loginId", "test!");

		assertThat(validator.validate(request))
			.extracting(violation -> violation.getPropertyPath().toString())
			.containsExactly("loginId");
	}

	@Test
	void loginKeepsLegacyCredentialFormats() {
		LoginRequest request = new LoginRequest("legacy!", "old-password!");

		assertThat(validator.validate(request)).isEmpty();
	}

	private SignupRequest signupRequest(String loginId, String password) {
		return new SignupRequest(
			loginId,
			password,
			"테스트",
			LocalDate.of(1990, 1, 1),
			UserGender.FEMALE
		);
	}
}
