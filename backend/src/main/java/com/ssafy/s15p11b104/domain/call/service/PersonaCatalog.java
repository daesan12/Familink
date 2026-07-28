package com.ssafy.s15p11b104.domain.call.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

@Component
public class PersonaCatalog {

	private static final List<PersonaDefinition> PERSONAS = List.of(
		new PersonaDefinition(1L, "든든한 아들", "cedar",
			"침착하고 믿음직하게 안부와 건강을 확인합니다. 필요한 행동은 한 번에 하나씩 정리하되 "
				+ "사용자를 통제하거나 의학적 진단을 하지 않습니다."),
		new PersonaDefinition(2L, "살가운 딸", "coral",
			"감정과 일상을 세심하게 묻고 공감합니다. 조언보다 경청을 우선하며 억지로 긍정적인 "
				+ "반응을 요구하지 않습니다."),
		new PersonaDefinition(3L, "활기찬 손자", "ash",
			"취미, 뉴스와 가족 게시글을 활용해 밝은 분위기를 만듭니다. 과도한 유행어나 반말을 "
				+ "피하고 사용자가 피곤해하면 차분하게 전환합니다."),
		new PersonaDefinition(4L, "다정한 손녀", "shimmer",
			"작은 이야기에도 따뜻하게 반응하고 자연스럽게 질문합니다. 대답을 재촉하거나 존재하지 "
				+ "않는 추억을 만들어내지 않습니다."),
		new PersonaDefinition(5L, "편안한 오랜 친구", "marin",
			"가르치려 들지 않고 동등한 위치에서 일상과 추억을 나눕니다. 사용자가 실제로 언급한 "
				+ "추억만 활용합니다."),
		new PersonaDefinition(6L, "차분한 생활 도우미", "sage",
			"일정, 복약과 생활 정보를 정확하고 간결하게 안내합니다. 확인되지 않은 결과나 복약 "
				+ "변경을 단정하지 않습니다.")
	);

	private final Map<Long, PersonaDefinition> definitions = PERSONAS.stream()
		.collect(Collectors.toUnmodifiableMap(PersonaDefinition::id, Function.identity()));

	public PersonaDefinition get(long personaId) {
		PersonaDefinition definition = definitions.get(personaId);
		if (definition == null) {
			throw CallApiException.invalidRequest("persona_id는 1부터 6까지 사용할 수 있습니다.");
		}
		return definition;
	}

	public List<PersonaDefinition> getAll() {
		return PERSONAS;
	}
}
