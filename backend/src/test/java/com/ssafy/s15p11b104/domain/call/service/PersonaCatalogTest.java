package com.ssafy.s15p11b104.domain.call.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class PersonaCatalogTest {

	private final PersonaCatalog personaCatalog = new PersonaCatalog();

	@Test
	void mapsAllPersonaIdsToExpectedVoices() {
		assertThat(personaCatalog.getAll())
			.extracting(PersonaDefinition::id, PersonaDefinition::voice)
			.containsExactly(
				org.assertj.core.groups.Tuple.tuple(1L, "cedar"),
				org.assertj.core.groups.Tuple.tuple(2L, "coral"),
				org.assertj.core.groups.Tuple.tuple(3L, "ash"),
				org.assertj.core.groups.Tuple.tuple(4L, "shimmer"),
				org.assertj.core.groups.Tuple.tuple(5L, "marin"),
				org.assertj.core.groups.Tuple.tuple(6L, "sage")
			);
	}

	@Test
	void rejectsUnknownPersonaId() {
		assertThatThrownBy(() -> personaCatalog.get(7L))
			.isInstanceOf(CallApiException.class)
			.extracting("code")
			.isEqualTo("INVALID_REQUEST");
	}
}
