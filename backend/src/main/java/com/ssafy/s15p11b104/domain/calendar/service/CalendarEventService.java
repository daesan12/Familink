package com.ssafy.s15p11b104.domain.calendar.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventCreateRequest;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventCreateResponse;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventDetailResponse;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListItem;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventListResponse;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventUpdateRequest;
import com.ssafy.s15p11b104.domain.calendar.dto.CalendarEventUpdateResponse;
import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;
import com.ssafy.s15p11b104.domain.calendar.entity.EventParticipant;
import com.ssafy.s15p11b104.domain.calendar.repository.CalendarEventRepository;
import com.ssafy.s15p11b104.domain.calendar.repository.EventParticipantRepository;
import com.ssafy.s15p11b104.domain.group.entity.GroupMember;
import com.ssafy.s15p11b104.domain.group.repository.GroupMemberRepository;
import com.ssafy.s15p11b104.global.exception.BusinessException;
import com.ssafy.s15p11b104.global.exception.ErrorCode;

/**
 * 그룹 공유 일정의 조회·등록·수정·삭제와 참여자 관리를 담당한다.
 *
 * <p>{@code API-CALENDAR-001}~{@code 005}를 구현한다. 계약이 명시한 오류는
 * {@code INVALID_REQUEST}, {@code UNAUTHORIZED}, {@code FORBIDDEN}뿐이므로 존재하지 않는 일정도
 * {@code FORBIDDEN}으로 응답해 리소스 존재 여부를 노출하지 않는다.
 */
@Service
public class CalendarEventService {

	private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Seoul");

	private final CalendarEventRepository calendarEventRepository;
	private final EventParticipantRepository eventParticipantRepository;
	private final GroupMemberRepository groupMemberRepository;

	public CalendarEventService(
		CalendarEventRepository calendarEventRepository,
		EventParticipantRepository eventParticipantRepository,
		GroupMemberRepository groupMemberRepository) {
		this.calendarEventRepository = calendarEventRepository;
		this.eventParticipantRepository = eventParticipantRepository;
		this.groupMemberRepository = groupMemberRepository;
	}

	/**
	 * 조회 구간과 겹치는 그룹 일정 목록을 반환한다.
	 */
	@Transactional(readOnly = true)
	public CalendarEventListResponse getEvents(
		Long groupId, LocalDate startDate, LocalDate endDate, Long authenticatedUserId) {
		getActiveMember(groupId, authenticatedUserId);
		validateQueryRange(startDate, endDate);

		List<CalendarEventListItem> events =
			calendarEventRepository.findAllByGroupIdAndDateRangeOverlap(groupId, startDate, endDate).stream()
				.map(event -> new CalendarEventListItem(
					event.getId(),
					event.getTitle(),
					event.getEventDate(),
					event.getEndDate(),
					event.getStartAt(),
					event.getEndAt()))
				.toList();
		return new CalendarEventListResponse(events);
	}

	/**
	 * 일정 상세와 참여자 구성원 ID 목록을 반환한다.
	 */
	@Transactional(readOnly = true)
	public CalendarEventDetailResponse getEvent(Long eventId, Long authenticatedUserId) {
		CalendarEvent event = getEvent(eventId);
		getActiveMember(event.getGroup().getId(), authenticatedUserId);

		return new CalendarEventDetailResponse(
			event.getId(),
			event.getGroup().getId(),
			event.getTitle(),
			event.getDescription(),
			event.getEventDate(),
			event.getEndDate(),
			event.getStartAt(),
			event.getEndAt(),
			event.getCreatorMember().getId(),
			eventParticipantRepository.findMemberIdsByEventId(event.getId()));
	}

	/**
	 * 일정을 등록하고 참여자를 연결한다.
	 */
	@Transactional
	public CalendarEventCreateResponse create(
		Long groupId, CalendarEventCreateRequest request, Long authenticatedUserId) {
		GroupMember creator = getActiveMember(groupId, authenticatedUserId);
		EventSchedule schedule = resolveSchedule(
			request.eventDate(), request.endDate(), request.startAt(), request.endAt());
		List<GroupMember> participants = resolveParticipants(groupId, request.participantMemberIds());

		CalendarEvent event = calendarEventRepository.save(new CalendarEvent(
			creator.getGroup(),
			creator,
			request.title(),
			request.description(),
			schedule.eventDate(),
			schedule.endDate(),
			schedule.startAt(),
			schedule.endAt()));
		eventParticipantRepository.saveAll(participants.stream()
			.map(participant -> new EventParticipant(event, participant))
			.toList());

		return new CalendarEventCreateResponse(event.getId(), event.getCreatedAt());
	}

	/**
	 * 일정의 모든 편집 가능 필드와 참여자를 통째로 교체한다.
	 */
	@Transactional
	public CalendarEventUpdateResponse update(
		Long eventId, CalendarEventUpdateRequest request, Long authenticatedUserId) {
		CalendarEvent event = getEvent(eventId);
		GroupMember editor = requireEditor(event, authenticatedUserId);
		EventSchedule schedule = resolveSchedule(
			request.eventDate(), request.endDate(), request.startAt(), request.endAt());
		List<GroupMember> participants =
			resolveParticipants(event.getGroup().getId(), request.participantMemberIds());

		event.update(
			editor,
			request.title(),
			request.description(),
			schedule.eventDate(),
			schedule.endDate(),
			schedule.startAt(),
			schedule.endAt());
		replaceParticipants(event, participants);
		calendarEventRepository.flush();

		return new CalendarEventUpdateResponse(event.getId(), editor.getId(), event.getUpdatedAt());
	}

	/**
	 * 일정과 참여자를 하드 삭제한다.
	 */
	@Transactional
	public void delete(Long eventId, Long authenticatedUserId) {
		CalendarEvent event = getEvent(eventId);
		requireEditor(event, authenticatedUserId);

		eventParticipantRepository.deleteAllByEventId(event.getId());
		eventParticipantRepository.flush();
		calendarEventRepository.delete(event);
	}

	private GroupMember getActiveMember(Long groupId, Long authenticatedUserId) {
		return groupMemberRepository.findActiveByGroupIdAndUserId(groupId, authenticatedUserId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	/**
	 * 일정을 조회한다. 계약에 404가 없으므로 존재하지 않으면 {@code FORBIDDEN}으로 거부한다.
	 */
	private CalendarEvent getEvent(Long eventId) {
		return calendarEventRepository.findById(eventId)
			.orElseThrow(() -> new BusinessException(ErrorCode.FORBIDDEN));
	}

	/**
	 * 일정을 수정·삭제할 수 있는 요청자인지 확인하고 최종 수정자로 기록할 구성원을 반환한다.
	 *
	 * <p>계약이 작성자 또는 그룹 관리자만 허용한다. 그룹의 활성 구성원이 아니면 두 조건을 보기 전에
	 * 거부한다.
	 */
	private GroupMember requireEditor(CalendarEvent event, Long authenticatedUserId) {
		GroupMember requester = getActiveMember(event.getGroup().getId(), authenticatedUserId);
		if (!requester.getId().equals(event.getCreatorMember().getId()) && !requester.isManager()) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}
		return requester;
	}

	/**
	 * 요청의 날짜·시각 입력을 저장할 일정 기간으로 정규화한다.
	 *
	 * <p>시간 일정은 {@code startAt}·{@code endAt}의 {@code Asia/Seoul} 날짜를 서버가 파생하며 요청에
	 * 담긴 날짜 값을 무시한다. 날짜 일정은 요청의 날짜만 사용하고 종료 날짜를 생략하면 하루짜리
	 * 일정으로 본다. 날짜 파생 경로를 이 메서드 하나로 고정해 {@code event_date}와 {@code start_at}의
	 * 날짜가 어긋나지 않게 한다.
	 */
	private EventSchedule resolveSchedule(
		LocalDate eventDate, LocalDate endDate, Instant startAt, Instant endAt) {
		if ((startAt == null) != (endAt == null)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		if (startAt != null) {
			if (endAt.isBefore(startAt)) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			return new EventSchedule(
				LocalDate.ofInstant(startAt, BUSINESS_ZONE),
				LocalDate.ofInstant(endAt, BUSINESS_ZONE),
				startAt,
				endAt);
		}
		if (eventDate == null) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		LocalDate resolvedEndDate = endDate == null ? eventDate : endDate;
		if (resolvedEndDate.isBefore(eventDate)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
		return new EventSchedule(eventDate, resolvedEndDate, null, null);
	}

	/**
	 * 요청한 참여자 ID를 해당 그룹의 활성 구성원으로 해석한다.
	 *
	 * <p>중복 ID는 {@code uq_event_participants_event_member}가 같은 사실로 취급하므로 조용히 제거한다.
	 * 존재하지 않거나 다른 그룹이거나 이미 탈퇴한 구성원이면 본문 값의 문제이므로
	 * {@code INVALID_REQUEST}로 거부한다.
	 */
	private List<GroupMember> resolveParticipants(Long groupId, List<Long> requestedMemberIds) {
		if (requestedMemberIds == null || requestedMemberIds.isEmpty()) {
			return List.of();
		}
		Map<Long, GroupMember> activeById = groupMemberRepository.findAllActiveByGroupId(groupId).stream()
			.collect(Collectors.toMap(GroupMember::getId, Function.identity()));

		List<GroupMember> participants = new ArrayList<>();
		for (Long memberId : new LinkedHashSet<>(requestedMemberIds)) {
			GroupMember participant = activeById.get(memberId);
			if (participant == null) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			participants.add(participant);
		}
		return participants;
	}

	/**
	 * 일정의 참여자를 전부 지우고 새 목록으로 다시 넣는다.
	 *
	 * <p>삽입 전에 flush로 삭제를 먼저 반영해야 유니크 제약과 충돌하지 않는다.
	 */
	private void replaceParticipants(CalendarEvent event, List<GroupMember> participants) {
		eventParticipantRepository.deleteAllByEventId(event.getId());
		eventParticipantRepository.flush();
		eventParticipantRepository.saveAll(participants.stream()
			.map(participant -> new EventParticipant(event, participant))
			.toList());
	}

	private void validateQueryRange(LocalDate startDate, LocalDate endDate) {
		if (startDate.isAfter(endDate)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}

	private record EventSchedule(LocalDate eventDate, LocalDate endDate, Instant startAt, Instant endAt) {
	}
}
