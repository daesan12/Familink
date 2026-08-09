import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useEffect,
  useState} from 'react';
import {Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {
  formatMonthLabel,
  getActiveDaySet,
  getCalendarWeeks,
  shiftMonth,
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
                color={COLORS.purpleDeep}
                name="chevron-left"
                size={22}
              />
            </Pressable>
            <AppText style={styles.monthLabel}>
              {formatMonthLabel(year, month)}
            </AppText>
            <Pressable
              accessibilityLabel="다음 달"
              accessibilityRole="button"
              onPress={() => goToMonth(1)}
              style={styles.navButton}
            >
              <MaterialDesignIcons
                color={COLORS.purpleDeep}
                name="chevron-right"
                size={22}
              />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map(label => (
              <AppText key={label} style={styles.weekdayLabel}>
                {label}
              </AppText>
            ))}
          </View>

          {weeks.map(week => (
            <View key={week[0].dateKey} style={styles.weekRow}>
              {week.map(cell => {
                // 인접 달 칸은 7열 정렬용이므로 흐리게만 보여 주고 선택할 수 없다.
                // 월 정보가 없는 숫자만 읽히면 혼란스러워 접근성 트리에서 감춘다.
                if (!cell.inMonth) {
                  return (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      key={cell.dateKey}
                      style={styles.dayCell}
                    >
                      <AppText style={styles.dayOutsideText}>{cell.day}</AppText>
                    </View>
                  );
                }

                const hasPosts = activeDays.has(cell.day);
                if (!hasPosts) {
                  return (
                    <View key={cell.dateKey} style={styles.dayCell}>
                      <AppText style={styles.dayDisabledText}>{cell.day}</AppText>
                    </View>
                  );
                }

                return (
                  <View key={cell.dateKey} style={styles.dayCell}>
                    <Pressable
                      accessibilityHint="이 날짜의 게시글만 모아 봅니다"
                      accessibilityLabel={`${month}월 ${cell.day}일 게시글 보기`}
                      accessibilityRole="button"
                      onPress={() => onSelectDate(cell.dateKey)}
                      style={styles.dayActive}
                    >
                      <AppText style={styles.dayActiveText}>{cell.day}</AppText>
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
  // 기준 달인데 게시글만 없는 날. 인접 달(textDisabled)과 확실히 구분되도록
  // 기준 화면처럼 당월은 읽히는 진한 색을 쓴다. 누를 수 있는지는 색이 아니라
  // 라벤더 알약이 나타낸다.
  dayDisabledText: {
    color: COLORS.textMuted,
    fontSize: 15,
  },
  // 인접 달 표기는 기준 화면(CalendarMonthGrid.outsideDayNumber)과 같은 토큰을 쓴다.
  // 더 옅은 inactive는 흰 배경에서 대비가 1.4:1까지 떨어져 숫자가 읽히지 않는다.
  dayOutsideText: {
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
  // 화면 상단 뒤로가기 버튼과 같은 옷을 입힌다. 회색 원은 이 서비스에서 이 자리에만
  // 쓰여 튀어 보였다.
  navButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
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
