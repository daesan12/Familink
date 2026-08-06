package com.ssafy.s15p11b104.domain.call.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.call.entity.CallReport;
import com.ssafy.s15p11b104.domain.call.entity.CallStatus;
import com.ssafy.s15p11b104.domain.call.repository.CallReportCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.GroupMemberCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.MemberAliasCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.MemberInterestCallRepository;
import com.ssafy.s15p11b104.domain.call.repository.PostAnalysisCallRepository;
import com.ssafy.s15p11b104.domain.feed.entity.AnalysisStatus;
import com.ssafy.s15p11b104.domain.feed.entity.PostAnalysis;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.MemberAlias;

@Component
public class AiCallPromptContextProvider {

	private static final ZoneId KST = ZoneId.of("Asia/Seoul");

	private final GroupMemberCallRepository groupMemberRepository;
	private final MemberInterestCallRepository memberInterestRepository;
	private final MemberAliasCallRepository memberAliasRepository;
	private final PostAnalysisCallRepository postAnalysisRepository;
	private final CallReportCallRepository callReportRepository;
	private final Clock clock;

	public AiCallPromptContextProvider(
		GroupMemberCallRepository groupMemberRepository,
		MemberInterestCallRepository memberInterestRepository,
		MemberAliasCallRepository memberAliasRepository,
		PostAnalysisCallRepository postAnalysisRepository,
		CallReportCallRepository callReportRepository,
		Clock clock
	) {
		this.groupMemberRepository = groupMemberRepository;
		this.memberInterestRepository = memberInterestRepository;
		this.memberAliasRepository = memberAliasRepository;
		this.postAnalysisRepository = postAnalysisRepository;
		this.callReportRepository = callReportRepository;
		this.clock = clock;
	}

	@Transactional(readOnly = true)
	public AiCallSessionContext load(GroupMember careReceiver) {
		Long careReceiverId = careReceiver.getId();
		Long groupId = careReceiver.getGroup().getId();
		LocalDate today = LocalDate.now(clock.withZone(KST));
		ZonedDateTime startOfDay = today.atStartOfDay(KST);
		ZonedDateTime endOfDay = startOfDay.plusDays(1);

		List<String> interests = memberInterestRepository
			.findAllByCareReceiverMemberIdOrderByCreatedAtAsc(careReceiverId)
			.stream()
			.map(interest -> interest.getInterestText())
			.toList();

		Map<Long, String> aliases = loadAliases(groupId, careReceiverId);
		FamilyMemberContexts familyMemberContexts = loadFamilyMembers(
			groupId, careReceiverId, aliases);
		List<AiCallPromptContext.TodayPostContext> todayPosts = loadTodayPosts(
			groupId, careReceiverId, startOfDay, endOfDay, aliases);
		List<AiCallPromptContext.RecentCallContext> recentCalls = loadRecentCalls(careReceiverId);

		AiCallPromptContext promptContext = new AiCallPromptContext(
			new AiCallPromptContext.CareReceiverContext(careReceiver.getUser().getName(), interests, today),
			familyMemberContexts.promptContexts(),
			todayPosts,
			recentCalls
		);
		return new AiCallSessionContext(promptContext, familyMemberContexts.personReferences());
	}

	private Map<Long, String> loadAliases(Long groupId, Long careReceiverId) {
		Map<Long, String> aliases = new HashMap<>();
		for (MemberAlias alias : memberAliasRepository.findAliases(groupId, careReceiverId)) {
			aliases.put(alias.getTargetMember().getId(), alias.getAlias());
		}
		return aliases;
	}

	private FamilyMemberContexts loadFamilyMembers(
		Long groupId,
		Long careReceiverId,
		Map<Long, String> aliases
	) {
		List<AiCallPromptContext.FamilyMemberContext> contexts = new ArrayList<>();
		Map<String, AiCallPersonReference> references = new LinkedHashMap<>();
		for (GroupMember member : groupMemberRepository.findActiveMembers(groupId)) {
			if (member.getId().equals(careReceiverId)) {
				continue;
			}
			String personKey = "person_" + (contexts.size() + 1);
			String name = member.getUser().getName();
			String displayName = aliases.getOrDefault(member.getId(), name);
			contexts.add(new AiCallPromptContext.FamilyMemberContext(
				personKey,
				name,
				displayName
			));
			references.put(personKey, new AiCallPersonReference(member.getId(), name, displayName));
		}
		return new FamilyMemberContexts(List.copyOf(contexts), references);
	}

	private List<AiCallPromptContext.TodayPostContext> loadTodayPosts(
		Long groupId,
		Long careReceiverId,
		ZonedDateTime startOfDay,
		ZonedDateTime endOfDay,
		Map<Long, String> aliases
	) {
		List<PostAnalysis> analyses = new ArrayList<>(postAnalysisRepository.findSuccessfulTodayExcludingAuthor(
			groupId,
			careReceiverId,
			AnalysisStatus.SUCCESS,
			startOfDay.toInstant(),
			endOfDay.toInstant(),
			PageRequest.of(0, 10)
		));
		Collections.reverse(analyses);

		return analyses.stream()
			.map(analysis -> {
				GroupMember author = analysis.getPost().getAuthorMember();
				String displayName = aliases.getOrDefault(
					author.getId(), author.getUser().resolveDisplayName());
				return new AiCallPromptContext.TodayPostContext(
					displayName,
					analysis.getSummary(),
					analysis.getPost().getCreatedAt().atOffset(ZoneOffset.UTC).atZoneSameInstant(KST).toOffsetDateTime()
				);
			})
			.toList();
	}

	private List<AiCallPromptContext.RecentCallContext> loadRecentCalls(Long careReceiverId) {
		return callReportRepository.findRecent(
				careReceiverId,
				CallStatus.COMPLETED,
				PageRequest.of(0, 5)
			)
			.stream()
			.map(report -> new AiCallPromptContext.RecentCallContext(
				report.getSummary(),
				report.getCallSession().getEndedAt().atZone(KST).toLocalDate()
			))
			.toList();
	}

	private record FamilyMemberContexts(
		List<AiCallPromptContext.FamilyMemberContext> promptContexts,
		Map<String, AiCallPersonReference> personReferences
	) {
	}
}
