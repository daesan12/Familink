package com.ssafy.s15p11b104.domain.call.service;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

public record AiCallSessionContext(
	AiCallPromptContext promptContext,
	Map<String, AiCallPersonReference> personReferences
) {

	public AiCallSessionContext {
		Objects.requireNonNull(promptContext);
		Objects.requireNonNull(personReferences);
		personReferences = Collections.unmodifiableMap(new LinkedHashMap<>(personReferences));
	}
}
