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

const EVENT_PALETTE = [
  {background: '#D9EAF2', foreground: '#315E72'},
  {background: '#DCE8D3', foreground: '#496346'},
  {background: '#F3E5A6', foreground: '#715E16'},
  {background: '#EFC3A5', foreground: '#7A4933'},
  {background: '#DDD8F0', foreground: '#554C7E'},
] as const;
const MAX_VISIBLE_LANES = 3;

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
              {week.days.map((day, columnIndex) => {
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
                      columnIndex < 6 && styles.dayCellDivider,
                      pressed && styles.pressedDay,
                    ]}
                  >
                    <View
                      style={[
                        styles.dayNumberCircle,
                        isToday && styles.todayCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          columnIndex === 0 &&
                            day.isCurrentMonth &&
                            styles.sundayNumber,
                          !day.isCurrentMonth && styles.outsideDayNumber,
                          isToday && styles.todayNumber,
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
  const color =
    EVENT_PALETTE[hashId(segment.event.id) % EVENT_PALETTE.length];

  return (
    <>
      {leading > 0 ? <View style={{flex: leading}} /> : null}
      <View
        accessibilityLabel={`${segment.event.title} 일정`}
        accessibilityRole="text"
        style={[
          styles.eventBar,
          {
            backgroundColor: color.background,
            flex: length,
          },
          segment.continuesBefore && styles.continuesBefore,
          segment.continuesAfter && styles.continuesAfter,
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.eventTitle, {color: color.foreground}]}
        >
          {segment.event.title}
        </Text>
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
    alignItems: 'flex-start',
    flex: 1,
    paddingLeft: 4,
    paddingTop: 5,
  },
  dayCellDivider: {
    borderRightColor: '#EEF0F2',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  dayNumber: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  dayNumberCircle: {
    alignItems: 'center',
    borderRadius: RADII.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  dayRow: {
    flex: 1,
    flexDirection: 'row',
  },
  eventBar: {
    borderCurve: 'continuous',
    borderRadius: 3,
    height: 17,
    justifyContent: 'center',
    marginHorizontal: 0.5,
    overflow: 'hidden',
    paddingHorizontal: 5,
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
    top: 34,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  month: {
    borderBottomColor: '#E7E9EC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
  },
  outsideDayNumber: {
    color: COLORS.textDisabled,
    fontWeight: '500',
  },
  overflowText: {
    bottom: 3,
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    position: 'absolute',
    right: 6,
  },
  pressedDay: {
    backgroundColor: COLORS.surface,
  },
  sundayNumber: {
    color: '#E06659',
  },
  todayCircle: {
    backgroundColor: '#222222',
  },
  todayNumber: {
    color: COLORS.background,
    fontWeight: '800',
  },
  week: {
    borderTopColor: '#E7E9EC',
    borderTopWidth: StyleSheet.hairlineWidth,
    flex: 1,
    overflow: 'hidden',
  },
});
