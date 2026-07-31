package com.ssafy.s15p11b104.domain.calendar.repository;

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
}
