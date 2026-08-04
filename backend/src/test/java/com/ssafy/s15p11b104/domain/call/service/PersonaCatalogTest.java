package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import com.ssafy.s15p11b104.domain.account.entity.UserGender;

class PersonaCatalogTest {

	private final PersonaCatalog personaCatalog = new PersonaCatalog();

	@Test
	void mapsAllPersonaIdsToExpectedVoices() {
		assertThat(personaCatalog.getAll())
			.extracting(
				PersonaDefinition::id,
				PersonaDefinition::name,
				PersonaDefinition::voice,
				PersonaDefinition::addressPolicy
			)
			.containsExactly(
				org.assertj.core.groups.Tuple.tuple(1L, "사랑스러운 아들", "ash", PersonaAddressPolicy.PARENT),
				org.assertj.core.groups.Tuple.tuple(2L, "사랑스러운 딸", "sage", PersonaAddressPolicy.PARENT),
				org.assertj.core.groups.Tuple.tuple(3L, "남자 비서", "cedar", PersonaAddressPolicy.EXECUTIVE),
				org.assertj.core.groups.Tuple.tuple(4L, "여자 비서", "marin", PersonaAddressPolicy.EXECUTIVE),
				org.assertj.core.groups.Tuple.tuple(5L, "친구 학수", "verse", PersonaAddressPolicy.PEER),
				org.assertj.core.groups.Tuple.tuple(6L, "친구 복희", "ballad", PersonaAddressPolicy.PEER)
			);
		assertThat(personaCatalog.getAll())
			.allSatisfy(persona -> assertThat(persona.samplePhrases()).hasSize(2));
	}

	@Test
	void keepsPersonalityFreeOfAiLabel() {
		assertThat(personaCatalog.getAll())
			.allSatisfy(persona -> assertThat(persona.personality())
				.doesNotContain("AI")
				.endsWith("말동무입니다."));
	}

	@Test
	void keepsSamplePhrasesWithinSpokenLengthLimit() {
		for (UserGender gender : UserGender.values()) {
			assertThat(personaCatalog.getAll())
				.allSatisfy(persona -> assertThat(persona.renderedSamplePhrases(gender))
					.allSatisfy(samplePhrase -> assertThat(samplePhrase.length())
						.as("%s 예시 발화 \"%s\"는 프롬프트의 25자 상한을 지켜야 한다", persona.name(), samplePhrase)
						.isLessThanOrEqualTo(25)));
		}
	}

	@Test
	void rejectsUnknownPersonaId() {
		assertThatThrownBy(() -> personaCatalog.get(7L))
			.isInstanceOf(CallApiException.class)
			.extracting("code")
			.isEqualTo("INVALID_REQUEST");
	}

	@Test
	void rejectsMissingGenderForAddressedPersona() {
		assertThatThrownBy(() -> personaCatalog.get(1L).addressInstruction(null))
			.isInstanceOf(CallApiException.class)
			.extracting("code")
			.isEqualTo("INVALID_REQUEST");
		assertThat(personaCatalog.get(5L).addressInstruction(null))
			.contains("고정 직함이나 가족 호칭을 사용하지 않고");
	}
}
