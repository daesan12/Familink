import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {
  buildWeekEventLayout,
  type CalendarMonth,
  type EventSegment,
} from '../calendarModel';
import type {
  CalendarEventSummary,
  DateKey,
} from '../types';

const EVENT_COLORS = ['#7160E0', '#397D75', '#C0694A', '#7A6599'] as const;
const MAX_VISIBLE_LANES = 2;

export const CALENDAR_WEEK_HEIGHT = 64;
export const CALENDAR_MONTH_HEIGHT = CALENDAR_WEEK_HEIGHT * 6;

interface CalendarMonthGridProps {
  events: readonly CalendarEventSummary[];
  month: CalendarMonth;
  onSelectDate: (dateKey: DateKey) => void;
  selectedDate: DateKey;
  today: DateKey;
}

export function CalendarMonthGrid({
  events,
  month,
  onSelectDate,
  selectedDate,
  today,
}: CalendarMonthGridProps) {
  return (
    <View style={styles.month}>
      {month.weeks.map(week => {
        const layout = buildWeekEventLayout(
          week,
          events,
          MAX_VISIBLE_LANES,
        );

        return (
          <View key={week.startDate} style={styles.week}>
            <View style={styles.dayRow}>
              {week.days.map(day => {
                const isToday = day.dateKey === today;
                const isSelected = day.dateKey === selectedDate;
                const hasEvent = events.some(
                  event =>
                    event.eventDate <= day.dateKey &&
                    event.endDate >= day.dateKey,
                );
                const overflowCount =
                  layout.overflowByDate[day.dateKey] ?? 0;

                return (
                  <Pressable
                    accessibilityLabel={`${day.year}년 ${day.month}월 ${day.day}일`}
                    accessibilityRole="button"
                    accessibilityState={{selected: isSelected}}
                    accessibilityValue={{
                      text: hasEvent ? '일정 있음' : '일정 없음',
                    }}
                    key={day.dateKey}
                    onPress={() => onSelectDate(day.dateKey)}
                    style={({pressed}) => [
                      styles.dayCell,
                      pressed && styles.pressedDay,
                    ]}
                  >
                    <View
                      style={[
                        styles.dayNumberCircle,
                        hasEvent && styles.eventDateCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          !day.isCurrentMonth && styles.outsideDayNumber,
                          hasEvent && styles.eventDateNumber,
                          isToday && !hasEvent && styles.todayNumber,
                        ]}
                      >
                        {day.day}
                      </Text>
                    </View>
                    {overflowCount > 0 ? (
                      <Text style={styles.overflowText}>
                        +{overflowCount}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View pointerEvents="none" style={styles.eventsOverlay}>
              {Array.from({length: MAX_VISIBLE_LANES}, (_, lane) => (
                <View key={lane} style={styles.eventLane}>
                  {layout.segments
                    .filter(segment => segment.lane === lane)
                    .map(segment => (
                      <EventBar
                        key={segment.event.id}
                        segment={segment}
                      />
                    ))}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EventBar({
  segment,
}: {
  segment: EventSegment;
}) {
  const leading = segment.startColumn;
  const length = segment.endColumn - segment.startColumn + 1;
  const trailing = 7 - segment.endColumn - 1;
  const color = EVENT_COLORS[hashId(segment.event.id) % EVENT_COLORS.length];

  return (
    <>
      {leading > 0 ? <View style={{flex: leading}} /> : null}
      <View
        accessibilityLabel={`${segment.event.title} 일정`}
        accessibilityRole="text"
        style={[
          styles.eventBar,
          {
            backgroundColor: color,
            flex: length,
          },
          segment.continuesBefore && styles.continuesBefore,
          segment.continuesAfter && styles.continuesAfter,
        ]}
      >
        {!segment.continuesBefore ? (
          <Text numberOfLines={1} style={styles.eventTitle}>
            {segment.event.title}
          </Text>
        ) : null}
      </View>
      {trailing > 0 ? <View style={{flex: trailing}} /> : null}
    </>
  );
}

function hashId(id: string): number {
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

const styles = StyleSheet.create({
  continuesAfter: {
    borderBottomRightRadius: 2,
    borderTopRightRadius: 2,
    marginRight: 0,
  },
  continuesBefore: {
    borderBottomLeftRadius: 2,
    borderTopLeftRadius: 2,
    marginLeft: 0,
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: RADII.medium,
    flex: 1,
    height: CALENDAR_WEEK_HEIGHT,
    paddingTop: 3,
  },
  dayNumber: {
    color: COLORS.textStrong,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  dayNumberCircle: {
    alignItems: 'center',
    borderRadius: RADII.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  dayRow: {
    flexDirection: 'row',
  },
  eventBar: {
    borderRadius: 4,
    height: 16,
    justifyContent: 'center',
    marginHorizontal: 1,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  eventLane: {
    flexDirection: 'row',
    height: 18,
    width: '100%',
  },
  eventsOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 28,
  },
  eventTitle: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '700',
  },
  month: {
    marginHorizontal: 12,
  },
  outsideDayNumber: {
    color: COLORS.textDisabled,
    fontWeight: '500',
  },
  overflowText: {
    bottom: 2,
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    position: 'absolute',
  },
  pressedDay: {
    backgroundColor: COLORS.surface,
  },
  eventDateCircle: {
    backgroundColor: COLORS.lavenderSurface,
    borderColor: COLORS.lavender,
    borderWidth: 1,
  },
  eventDateNumber: {
    color: COLORS.purpleDeep,
    fontWeight: '800',
  },
  todayNumber: {
    color: COLORS.error,
    fontWeight: '800',
  },
  week: {
    height: CALENDAR_WEEK_HEIGHT,
  },
});
