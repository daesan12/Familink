package com.ssafy.s15p11b104.domain.call.service;

import com.ssafy.s15p11b104.domain.account.entity.UserGender;

public enum PersonaAddressPolicy {
	PARENT("아빠", "엄마"),
	EXECUTIVE("회장님", "사모님"),
	PEER(null, null);

	private static final String ADDRESS_PLACEHOLDER = "{호칭}";

	private final String maleAddress;
	private final String femaleAddress;

	PersonaAddressPolicy(String maleAddress, String femaleAddress) {
		this.maleAddress = maleAddress;
		this.femaleAddress = femaleAddress;
	}

	public String instruction(UserGender gender) {
		if (this == PEER) {
			return "고정 직함이나 가족 호칭을 사용하지 않고 동년배 친구처럼 자연스럽게 말을 겁니다. "
				+ "피보호자 이름은 필요한 경우에만 가끔 부릅니다.";
		}

		String address = resolveAddress(gender);
		if (this == PARENT) {
			return "사용자를 \"" + address + "\"라고 부릅니다. 다른 가족 호칭이나 \"어르신\", "
				+ "\"고객님\"으로 바꾸지 않습니다.";
		}
		return "사용자를 \"" + address + "\"이라고 부릅니다. 다른 직함이나 가족 호칭으로 바꾸지 않습니다.";
	}

	public String renderSamplePhrase(String samplePhrase, UserGender gender) {
		if (!samplePhrase.contains(ADDRESS_PLACEHOLDER)) {
			return samplePhrase;
		}
		return samplePhrase.replace(ADDRESS_PLACEHOLDER, resolveAddress(gender));
	}

	private String resolveAddress(UserGender gender) {
		if (gender == null) {
			throw CallApiException.invalidRequest("자식 또는 비서 페르소나의 호칭을 결정하려면 사용자 성별이 필요합니다.");
		}
		return gender == UserGender.MALE ? maleAddress : femaleAddress;
	}
}
