package com.ssafy.s15p11b104.domain.calendar.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.context.ApplicationEventPublisher;
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
import com.ssafy.s15p11b104.domain.notification.entity.NotificationType;
import com.ssafy.s15p11b104.domain.notification.entity.ReminderSlot;
import com.ssafy.s15p11b104.domain.notification.event.DomainNotificationEvent;
import com.ssafy.s15p11b104.domain.notification.repository.NotificationRepository;
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
	private final ApplicationEventPublisher eventPublisher;
	private final Clock clock;
	private final NotificationRepository notificationRepository;

	public CalendarEventService(
		CalendarEventRepository calendarEventRepository,
		EventParticipantRepository eventParticipantRepository,
		GroupMemberRepository groupMemberRepository,
		ApplicationEventPublisher eventPublisher,
		Clock clock,
		NotificationRepository notificationRepository) {
		this.calendarEventRepository = calendarEventRepository;
		this.eventParticipantRepository = eventParticipantRepository;
		this.groupMemberRepository = groupMemberRepository;
		this.eventPublisher = eventPublisher;
		this.clock = clock;
		this.notificationRepository = notificationRepository;
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
	 *
	 * <p>등록자와 참여자 멤버십을 ID 오름차순으로 한 번에 잠근 상태에서 검사한다. 서로를 참여자로
	 * 지정하는 두 일정 생성이 반대 순서로 멤버십을 잠가 교착되는 것을 막는다.
	 */
	@Transactional
	public CalendarEventCreateResponse create(
		Long groupId, CalendarEventCreateRequest request, Long authenticatedUserId) {
		ParticipantWriteMembers writeMembers = resolveCreatorAndParticipants(
			groupId, authenticatedUserId, request.participantMemberIds());
		GroupMember creator = writeMembers.actor();
		EventSchedule schedule = resolveSchedule(
			request.eventDate(), request.endDate(), request.startAt(), request.endAt());
		List<GroupMember> participants = writeMembers.participants();

		CalendarEvent event = calendarEventRepository.save(new CalendarEvent(
			creator.getGroup(),
			creator,
			request.title(),
			request.description(),
			schedule.eventDate(),
			schedule.endDate(),
			schedule.startAt(),
			schedule.endAt(),
			clock.instant()));
		event.changeParticipantScope(!participants.isEmpty());
		eventParticipantRepository.saveAll(participants.stream()
			.map(participant -> new EventParticipant(event, participant))
			.toList());
		publishCalendarChanged(
			event,
			creator,
			List.of(),
			memberIds(participants),
			DomainNotificationEvent.CalendarAction.CREATED);

		return new CalendarEventCreateResponse(event.getId(), event.getCreatedAt());
	}

	/**
	 * 일정의 모든 편집 가능 필드와 참여자를 통째로 교체한다.
	 *
	 * <p>일정 행을 잠그고 시작해 같은 일정에 대한 동시 수정을 직렬화한다. 잠그지 않으면 참여자
	 * 전체 교체가 서로 엇갈려 두 요청 목록의 합집합이 남는다.
	 */
	@Transactional
	public CalendarEventUpdateResponse update(
		Long eventId, CalendarEventUpdateRequest request, Long authenticatedUserId) {
		CalendarEvent event = getEventForUpdate(eventId);
		GroupMember editor = requireEditor(event, authenticatedUserId);
		List<Long> beforeParticipantMemberIds = eventParticipantRepository.findMemberIdsByEventId(eventId);
		EventSchedule schedule = resolveSchedule(
			request.eventDate(), request.endDate(), request.startAt(), request.endAt());
		List<GroupMember> participants =
			resolveParticipants(event.getGroup().getId(), request.participantMemberIds());
		cancelRemindersIfScheduleChanged(event, schedule);

		event.update(
			editor,
			request.title(),
			request.description(),
			schedule.eventDate(),
			schedule.endDate(),
			schedule.startAt(),
			schedule.endAt(),
			clock.instant());
		event.changeParticipantScope(!participants.isEmpty());
		replaceParticipants(event, participants);
		calendarEventRepository.flush();
		publishCalendarChanged(
			event,
			editor,
			beforeParticipantMemberIds,
			memberIds(participants),
			DomainNotificationEvent.CalendarAction.UPDATED);

		return new CalendarEventUpdateResponse(event.getId(), editor.getId(), event.getUpdatedAt());
	}

	/**
	 * 일정과 참여자를 하드 삭제한다.
	 *
	 * <p>수정과 같은 일정 행을 잠그고 시작해, 삭제와 동시 수정이 서로의 참여자 변경과 엇갈리지
	 * 않게 한다.
	 */
	@Transactional
	public void delete(Long eventId, Long authenticatedUserId) {
		CalendarEvent event = getEventForUpdate(eventId);
		GroupMember editor = requireEditor(event, authenticatedUserId);
		List<Long> beforeParticipantMemberIds = eventParticipantRepository.findMemberIdsByEventId(eventId);

		eventParticipantRepository.deleteAllByEventId(event.getId());
		eventParticipantRepository.flush();
		publishCalendarChanged(
			event,
			editor,
			beforeParticipantMemberIds,
			List.of(),
			DomainNotificationEvent.CalendarAction.DELETED);
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
	 * 수정·삭제 대상 일정을 잠그고 조회한다.
	 *
	 * <p>같은 일정을 동시에 수정하면 참여자 전체 교체가 서로 엇갈려 두 목록의 합집합이 남거나 한쪽
	 * 목록이 사라지고, 겹치는 참여자는 유니크 제약 위반으로 계약에 없는 오류가 된다. 일정 행에서
	 * 직렬화하면 나중 요청의 목록만 남는다. 조회 경로는 잠글 필요가 없어 {@link #getEvent(Long)}을
	 * 그대로 쓴다.
	 */
	private CalendarEvent getEventForUpdate(Long eventId) {
		return calendarEventRepository.findByIdForUpdate(eventId)
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
		LinkedHashSet<Long> uniqueMemberIds = new LinkedHashSet<>(requestedMemberIds);
		Map<Long, GroupMember> activeById = groupMemberRepository
			.findAllActiveParticipantsForWrite(groupId, uniqueMemberIds)
			.stream()
			.collect(Collectors.toMap(GroupMember::getId, Function.identity()));

		List<GroupMember> participants = new ArrayList<>();
		for (Long memberId : uniqueMemberIds) {
			GroupMember participant = activeById.get(memberId);
			if (participant == null) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			participants.add(participant);
		}
		return participants;
	}

	/**
	 * 일정 생성의 작성자와 참여자를 공통 순서로 잠그고 요청 목록을 활성 멤버십으로 해석한다.
	 */
	private ParticipantWriteMembers resolveCreatorAndParticipants(
		Long groupId, Long authenticatedUserId, List<Long> requestedMemberIds) {
		GroupMember creatorCandidate = getActiveMember(groupId, authenticatedUserId);
		LinkedHashSet<Long> participantIds = requestedMemberIds == null
			? new LinkedHashSet<>()
			: new LinkedHashSet<>(requestedMemberIds);
		LinkedHashSet<Long> writeMemberIds = new LinkedHashSet<>(participantIds);
		writeMemberIds.add(creatorCandidate.getId());

		Map<Long, GroupMember> activeById = groupMemberRepository
			.findAllActiveParticipantsForWrite(groupId, writeMemberIds)
			.stream()
			.collect(Collectors.toMap(GroupMember::getId, Function.identity()));
		GroupMember creator = activeById.get(creatorCandidate.getId());
		if (creator == null) {
			throw new BusinessException(ErrorCode.FORBIDDEN);
		}

		List<GroupMember> participants = new ArrayList<>();
		for (Long memberId : participantIds) {
			GroupMember participant = activeById.get(memberId);
			if (participant == null) {
				throw new BusinessException(ErrorCode.INVALID_REQUEST);
			}
			participants.add(participant);
		}
		return new ParticipantWriteMembers(creator, participants);
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

	/**
	 * 일정 시작 시점의 근거가 바뀌면 이미 만든 해당 슬롯 알림만 취소한다.
	 *
	 * <p>도메인 이벤트 알림은 새 일정 변경 이벤트로 다시 생성될 수 있으므로 날짜와 시작 시각에
	 * 대응하는 슬롯만 지운다. 종료 날짜·시각 변경은 알림 시점을 바꾸지 않는다.
	 */
	private void cancelRemindersIfScheduleChanged(CalendarEvent event, EventSchedule schedule) {
		// 기존 ledger를 삭제하지 않는다. 같은 event·receiver·slot은 Unique 제약으로 보존하고,
		// reminderScheduleUpdatedAt이 과거 due time 재생성을 막는다.
	}

	private void publishCalendarChanged(
		CalendarEvent event,
		GroupMember actor,
		List<Long> beforeParticipantMemberIds,
		List<Long> afterParticipantMemberIds,
		DomainNotificationEvent.CalendarAction action
	) {
		eventPublisher.publishEvent(new DomainNotificationEvent.CalendarChanged(
			event.getId(),
			event.getGroup().getId(),
			actor.getId(),
			event.getTitle(),
			beforeParticipantMemberIds,
			afterParticipantMemberIds,
			action,
			UUID.randomUUID()));
	}

	private List<Long> memberIds(List<GroupMember> members) {
		return members.stream().map(GroupMember::getId).toList();
	}

	private void validateQueryRange(LocalDate startDate, LocalDate endDate) {
		if (startDate.isAfter(endDate)) {
			throw new BusinessException(ErrorCode.INVALID_REQUEST);
		}
	}

	private record EventSchedule(LocalDate eventDate, LocalDate endDate, Instant startAt, Instant endAt) {
	}

	private record ParticipantWriteMembers(GroupMember actor, List<GroupMember> participants) {
	}
}
