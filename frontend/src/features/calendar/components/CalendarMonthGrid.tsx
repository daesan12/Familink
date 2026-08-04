import {useState} from 'react';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
const MAX_VISIBLE_LANES = 2;
const MIN_VISIBLE_LANES = 0;
const EVENT_OVERLAY_TOP = 31;
const EVENT_BAR_HEIGHT = 13;
const EVENT_LANE_HEIGHT = 14;
const OVERFLOW_LINE_HEIGHT = 12;
const OVERFLOW_BOTTOM_INSET = 1;
const OVERFLOW_RESERVED_HEIGHT =
  OVERFLOW_LINE_HEIGHT + OVERFLOW_BOTTOM_INSET;
const WEEK_BOTTOM_INSET = 1;

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
  const [monthHeight, setMonthHeight] = useState(CALENDAR_MONTH_HEIGHT);
  const weekHeight = monthHeight / month.weeks.length;
  const fullLaneCapacity = getVisibleLaneCapacity(weekHeight, false);
  const overflowLaneCapacity = getVisibleLaneCapacity(weekHeight, true);

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setMonthHeight(currentHeight =>
      Math.abs(currentHeight - nextHeight) < 1 ? currentHeight : nextHeight,
    );
  };

  return (
    <View
      onLayout={handleLayout}
      style={styles.month}
      testID="calendar-month-grid">
      {month.weeks.map(week => {
        const fullLayout = buildWeekEventLayout(
          week,
          events,
          fullLaneCapacity,
        );
        const needsOverflowIndicator = Object.keys(
          fullLayout.overflowByDate,
        ).length > 0;
        const visibleLaneCount = needsOverflowIndicator
          ? overflowLaneCapacity
          : fullLaneCapacity;
        const layout =
          visibleLaneCount === fullLaneCapacity
            ? fullLayout
            : buildWeekEventLayout(week, events, visibleLaneCount);

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
              {Array.from({length: visibleLaneCount}, (_, lane) => (
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
  const length = segment.endColumn - segment.startColumn + 1;
  const color =
    EVENT_PALETTE[hashId(segment.event.id) % EVENT_PALETTE.length];
  const left = `${(segment.startColumn / 7) * 100}%` as `${number}%`;
  const width = `${(length / 7) * 100}%` as `${number}%`;

  return (
    <View style={[styles.eventSlot, {left, width}]}>
      <View
        accessibilityLabel={`${segment.event.title} 일정`}
        accessibilityRole="text"
        style={[
          styles.eventBar,
          {
            backgroundColor: color.background,
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
    </View>
  );
}

function hashId(id: string): number {
  return [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
}

function getVisibleLaneCapacity(
  weekHeight: number,
  reserveOverflowIndicator: boolean,
): number {
  const reservedBottom = reserveOverflowIndicator
    ? OVERFLOW_RESERVED_HEIGHT
    : WEEK_BOTTOM_INSET;
  const availableHeight = weekHeight - EVENT_OVERLAY_TOP - reservedBottom;
  const capacity =
    availableHeight < EVENT_BAR_HEIGHT
      ? 0
      : Math.floor(
          (availableHeight - EVENT_BAR_HEIGHT) / EVENT_LANE_HEIGHT,
        ) + 1;

  return Math.max(
    MIN_VISIBLE_LANES,
    Math.min(MAX_VISIBLE_LANES, capacity),
  );
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
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  dayRow: {
    flex: 1,
    flexDirection: 'row',
  },
  eventBar: {
    borderCurve: 'continuous',
    borderRadius: 3,
    flex: 1,
    height: EVENT_BAR_HEIGHT,
    justifyContent: 'center',
    marginLeft: 2,
    marginRight: 2,
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  eventLane: {
    height: EVENT_LANE_HEIGHT,
    position: 'relative',
    width: '100%',
  },
  eventSlot: {
    height: EVENT_BAR_HEIGHT,
    position: 'absolute',
    top: 0,
  },
  eventsOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: EVENT_OVERLAY_TOP,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: EVENT_BAR_HEIGHT,
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
    bottom: OVERFLOW_BOTTOM_INSET,
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    left: 7,
    lineHeight: OVERFLOW_LINE_HEIGHT,
    position: 'absolute',
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
