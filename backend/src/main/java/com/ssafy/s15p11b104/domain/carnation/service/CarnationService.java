package com.ssafy.s15p11b104.domain.carnation.service;

import java.time.LocalDate;
import java.time.ZoneId;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.carnation.repository.CarnationRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;

@Service
public class CarnationService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final CarnationRepository carnationRepository;

	public CarnationService(CarnationRepository carnationRepository) {
		this.carnationRepository = carnationRepository;
	}

	@Transactional
	public void earnForPost(GroupMember author) {
		if (author.getRole() != GroupRole.GUARDIAN) {
			return;
		}

		carnationRepository.insertIfAbsent(
			author.getGroup().getId(),
			author.getId(),
			LocalDate.now(BUSINESS_ZONE));
	}
}
