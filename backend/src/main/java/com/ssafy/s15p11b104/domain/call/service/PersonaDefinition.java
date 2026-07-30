package com.ssafy.s15p11b104.domain.call.service;

import java.util.List;

import com.ssafy.s15p11b104.domain.account.entity.UserGender;

public record PersonaDefinition(
	long id,
	String name,
	String voice,
	PersonaAddressPolicy addressPolicy,
	String personality,
	String speechStyle,
	String dialect,
	List<String> samplePhrases
) {

	public PersonaDefinition {
		samplePhrases = List.copyOf(samplePhrases);
	}

	public String addressInstruction(UserGender gender) {
		return addressPolicy.instruction(gender);
	}

	public List<String> renderedSamplePhrases(UserGender gender) {
		return samplePhrases.stream()
			.map(samplePhrase -> addressPolicy.renderSamplePhrase(samplePhrase, gender))
			.toList();
	}
}
