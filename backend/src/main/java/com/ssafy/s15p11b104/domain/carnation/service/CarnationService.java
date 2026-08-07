package com.ssafy.s15p11b104.domain.carnation.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.carnation.dto.CarnationCalendarResponse;
import com.ssafy.s15p11b104.domain.carnation.dto.GrassRankingResponse;
import com.ssafy.s15p11b104.domain.carnation.dto.GrassResponse;
import com.ssafy.s15p11b104.domain.carnation.repository.CarnationRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.entity.GroupRole;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.domain.group.repository.MemberAliasRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

@Service
public class CarnationService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final CarnationRepository carnationRepository;
	private final GroupMemberRepository groupMemberRepository;
	private final MemberAliasRepository memberAliasRepository;

	public CarnationService(
		CarnationRepository carnationRepository,
		GroupMemberRepository groupMemberRepository,
		MemberAliasRepository memberAliasRepository) {
		this.carnationRepository = carnationRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.memberAliasRepository = memberAliasRepository;
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

	@Transactional(readOnly = true)
	public CarnationCalendarResponse getCarnations(
		Long groupId,
		Long memberId,
		LocalDate startDate,
		LocalDate endDate,
		Long authenticatedUserId) {
		validateDateRange(startDate, endDate);
		getActiveMemberByUser(groupId, authenticatedUserId);
		getActiveMember(groupId, memberId);

		return new CarnationCalendarResponse(
			memberId,
			startDate,
			endDate,
			carnationRepository.findEarnedDates(groupId, memberId, startDate, endDate));
	}

	@Transactional(readOnly = true)
	public GrassResponse getGrass(
		Long groupId,
		LocalDate requestedStartDate,
		LocalDate requestedEndDate,
		Long authenticatedUserId) {
		GroupMember viewer = getActiveMemberByUser(groupId, authenticatedUserId);
		DateRange currentRange = resolveRange(requestedStartDate, requestedEndDate);
		DateRange previousRange = currentRange.previous();

		Map<Long, Long> currentCounts = toCountMap(
			carnationRepository.countByMember(
				groupId, currentRange.start(), currentRange.endExclusive()));
		Map<Long, Long> previousCounts = toCountMap(
			carnationRepository.countByMember(
				groupId, previousRange.start(), previousRange.endExclusive()));

		List<GroupMember> guardians = groupMemberRepository.findAllActiveByGroupId(groupId).stream()
			.filter(member -> member.getRole() == GroupRole.GUARDIAN)
			.toList();
		Map<Long, String> aliasesByTarget = memberAliasRepository
			.findAllByGroupIdAndOwnerMemberIdAndTargetMemberIdIn(
				groupId,
				viewer.getId(),
				guardians.stream().map(GroupMember::getId).toList())
			.stream()
			.collect(Collectors.toMap(
				alias -> alias.getTargetMember().getId(),
				alias -> alias.getAlias()));
		long previousWinnerCount = guardians.stream()
			.mapToLong(member -> previousCounts.getOrDefault(member.getId(), 0L))
			.max()
			.orElse(0L);

		List<RankingRow> rows = guardians.stream()
			.map(member -> new RankingRow(
				member.getId(),
				aliasesByTarget.getOrDefault(member.getId(), member.getUser().getName()),
				currentCounts.getOrDefault(member.getId(), 0L),
				previousWinnerCount > 0
					&& previousCounts.getOrDefault(member.getId(), 0L) == previousWinnerCount))
			.sorted(Comparator.comparingLong(RankingRow::carnationCount).reversed()
				.thenComparing(RankingRow::memberId))
			.toList();

		List<GrassRankingResponse> rankings = toRankings(rows);
		return new GrassResponse(currentRange.start(), currentRange.endInclusive(), rankings);
	}

	private List<GrassRankingResponse> toRankings(List<RankingRow> rows) {
		long previousCount = Long.MIN_VALUE;
		int rank = 0;
		List<GrassRankingResponse> rankings = new ArrayList<>();
		for (int index = 0; index < rows.size(); index++) {
			RankingRow row = rows.get(index);
			if (row.carnationCount() != previousCount) {
				rank = index + 1;
				previousCount = row.carnationCount();
			}
			rankings.add(new GrassRankingResponse(
				rank,
				row.memberId(),
				row.displayName(),
				row.carnationCount(),
				row.previousWeekWinner()));
		}
		return rankings;
	}

	private Map<Long, Long> toCountMap(List<CarnationRepository.CarnationCount> counts) {
		return counts.stream().collect(Collectors.toMap(
			CarnationRepository.CarnationCount::getMemberId,
			CarnationRepository.CarnationCount::getCarnationCount));
	}

	private GroupMember getActiveMember(Long groupId, Long memberId) {
		return groupMemberRepository.findActiveByGroupIdAndMemberId(groupId, memberId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private GroupMember getActiveMemberByUser(Long groupId, Long userId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, userId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	private void validateDateRange(LocalDate startDate, LocalDate endDate) {
		if (startDate == null || endDate == null || startDate.isAfter(endDate)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}

	private DateRange resolveRange(LocalDate requestedStartDate, LocalDate requestedEndDate) {
		if (requestedStartDate == null && requestedEndDate == null) {
			LocalDate today = LocalDate.now(BUSINESS_ZONE);
			LocalDate startOfWeek = today.with(DayOfWeek.MONDAY);
			return new DateRange(startOfWeek, startOfWeek.plusDays(6));
		}
		validateDateRange(requestedStartDate, requestedEndDate);
		if (requestedStartDate.getDayOfWeek() != DayOfWeek.MONDAY
			|| !requestedEndDate.equals(requestedStartDate.plusDays(6))) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return new DateRange(requestedStartDate, requestedEndDate);
	}

	private record DateRange(LocalDate start, LocalDate endInclusive) {

		private LocalDate endExclusive() {
			return endInclusive.plusDays(1);
		}

		private DateRange previous() {
			long days = ChronoUnit.DAYS.between(start, endInclusive) + 1;
			return new DateRange(start.minusDays(days), endInclusive.minusDays(days));
		}
	}

	private record RankingRow(
		Long memberId,
		String displayName,
		long carnationCount,
		boolean previousWeekWinner) {
	}
}
