import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {
  formatMonthLabel,
  getActiveDaySet,
  getCalendarWeeks,
  shiftMonth,
  toDateKey,
} from '../archiveModel';
import type {ArchiveMemberFilter, ArchivePost} from '../types';

interface ArchiveCalendarModalProps {
  initialMonth: {month: number; year: number};
  memberId: ArchiveMemberFilter;
  onClose: () => void;
  onSelectDate: (dateKey: string) => void;
  posts: readonly ArchivePost[];
  visible: boolean;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

export function ArchiveCalendarModal({
  initialMonth,
  memberId,
  onClose,
  onSelectDate,
  posts,
  visible,
}: ArchiveCalendarModalProps) {
  const [displayed, setDisplayed] = useState(initialMonth);

  useEffect(() => {
    if (visible) {
      setDisplayed(initialMonth);
    }
  }, [initialMonth, visible]);

  const {month, year} = displayed;
  const activeDays = getActiveDaySet(posts, year, month, memberId);
  const weeks = getCalendarWeeks(year, month);

  const goToMonth = (delta: number) =>
    setDisplayed(current => shiftMonth(current.year, current.month, delta));

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="달력 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.dim}
        />
        <View
          accessibilityViewIsModal
          onStartShouldSetResponder={() => true}
          style={styles.card}
        >
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="이전 달"
              accessibilityRole="button"
              onPress={() => goToMonth(-1)}
              style={styles.navButton}
            >
              <MaterialDesignIcons
                color={COLORS.background}
                name="chevron-left"
                size={22}
              />
            </Pressable>
            <Text style={styles.monthLabel}>
              {formatMonthLabel(year, month)}
            </Text>
            <Pressable
              accessibilityLabel="다음 달"
              accessibilityRole="button"
              onPress={() => goToMonth(1)}
              style={styles.navButton}
            >
              <MaterialDesignIcons
                color={COLORS.background}
                name="chevron-right"
                size={22}
              />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map(label => (
              <Text key={label} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.weekRow}>
              {week.map((day, dayIndex) => {
                if (day == null) {
                  return (
                    <View
                      key={`empty-${weekIndex}-${dayIndex}`}
                      style={styles.dayCell}
                    />
                  );
                }

                const hasPosts = activeDays.has(day);
                if (!hasPosts) {
                  return (
                    <View key={day} style={styles.dayCell}>
                      <Text style={styles.dayDisabledText}>{day}</Text>
                    </View>
                  );
                }

                return (
                  <View key={day} style={styles.dayCell}>
                    <Pressable
                      accessibilityHint="이 날짜의 게시글만 모아 봅니다"
                      accessibilityLabel={`${month}월 ${day}일 게시글 보기`}
                      accessibilityRole="button"
                      onPress={() => onSelectDate(toDateKey(year, month, day))}
                      style={styles.dayActive}
                    >
                      <Text style={styles.dayActiveText}>{day}</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    boxShadow: '0 12px 32px rgba(18, 23, 41, 0.22)',
    marginHorizontal: 24,
    paddingBottom: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  dayActive: {
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dayActiveText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  dayCell: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  dayDisabledText: {
    color: COLORS.textDisabled,
    fontSize: 15,
  },
  dim: {
    backgroundColor: COLORS.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthLabel: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: '#9AA0AC',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  root: {
    flex: 1,
    justifyContent: 'center',
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    color: COLORS.textSubtle,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    width: `${100 / 7}%`,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
});
