package com.ssafy.s15p11b104.domain.calendar.repository;

import java.time.Instant;
import java.time.LocalDate;
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

	/**
	 * 전날 09:00 알림을 보낼 일정을 모든 그룹에서 찾는다.
	 *
	 * <p>{@code dueAt}보다 늦게 등록하거나 수정한 일정은 알림 시점이 이미 지난 뒤에 지금의 모습이
	 * 되었으므로 제외한다. 그 판정에 {@code updatedAt}만 쓸 수 있는 것은 일정을 만들 때
	 * {@code createdAt}과 {@code updatedAt}이 같고 수정할 때마다 {@code updatedAt}이 오르기
	 * 때문이다.
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
	 *
	 * <p>시작 1시간 전 알림 후보를 좁히는 용도다. 시작 시각이 없는 날짜 일정은 조건에서 자연히
	 * 빠진다.
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
