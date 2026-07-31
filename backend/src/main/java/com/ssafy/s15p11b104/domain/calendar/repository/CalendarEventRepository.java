package com.ssafy.s15p11b104.domain.calendar.repository;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.s15p11b104.domain.calendar.entity.CalendarEvent;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

	/**
	 * 그룹 일정 중 조회 구간과 하루라도 겹치는 일정을 시작 날짜 순으로 반환한다.
	 *
	 * <p>여러 날에 걸친 일정을 포함해야 하므로 시작 날짜 일치가 아니라 기간 겹침으로 판정한다.
	 * 같은 시작 날짜에서는 시각이 없는 날짜 일정을 시간 일정보다 먼저 둔다.
	 */
	@Query("""
		select event
		from CalendarEvent event
		where event.group.id = :groupId
			and event.eventDate <= :endDate
			and event.endDate >= :startDate
		order by event.eventDate asc, event.startAt asc nulls first, event.id asc
		""")
	List<CalendarEvent> findAllByGroupIdAndDateRangeOverlap(
		@Param("groupId") Long groupId,
		@Param("startDate") LocalDate startDate,
		@Param("endDate") LocalDate endDate);

	@Query("""
		select event
		from CalendarEvent event
		where (event.startAt is not null and event.startAt between :timedStartAt and :timedEndAt)
			or event.eventDate between :firstEventDate and :lastEventDate
		order by event.id
		""")
	List<CalendarEvent> findReminderCandidates(
		@Param("timedStartAt") Instant timedStartAt,
		@Param("timedEndAt") Instant timedEndAt,
		@Param("firstEventDate") LocalDate firstEventDate,
		@Param("lastEventDate") LocalDate lastEventDate);

	/**
	 * 전날 09:00 알림을 보낼 일정을 모든 그룹에서 찾는다.
	 *
	 * <p>레거시 직접 저장 경로와 일정 알림 회귀 테스트가 사용하는 정밀 후보 조회다.
	 */
	@Query("""
		select event
		from CalendarEvent event
		where event.eventDate = :eventDate
			and event.updatedAt <= :dueAt
		order by event.id asc
		""")
	List<CalendarEvent> findAllDayBeforeReminderTargets(
		@Param("eventDate") LocalDate eventDate,
		@Param("dueAt") Instant dueAt);

	/**
	 * 지정한 구간 안에 시작하는 시간 일정을 모든 그룹에서 찾는다.
	 */
	@Query("""
		select event
		from CalendarEvent event
		where event.startAt > :now
			and event.startAt <= :until
		order by event.id asc
		""")
	List<CalendarEvent> findAllStartingWithin(
		@Param("now") Instant now,
		@Param("until") Instant until);
}
