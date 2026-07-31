import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useMemo, useState} from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {
  buildMonthGrid,
  chunkIntoWeeks,
  formatMonthTitle,
  monthOrdinal,
  shiftMonth,
  WEEKDAY_LABELS,
} from '../profileModel';
import {CarnationStamp} from './CarnationStamp';

interface MonthlyStampModalProps {
  visible: boolean;
  initialYear: number;
  initialMonth: number;
  // 이동 가능한 하한(가입월)·상한(현재월). 범위 밖으로는 넘어가지 않는다.
  minYear: number;
  minMonth: number;
  maxYear: number;
  maxMonth: number;
  postDates: readonly string[];
  onClose: () => void;
}

// I-5 월간 도장. 마이페이지 위에 뜨는 오버레이. 7열 주 단위로 배열하고,
// 기준 달은 진하게, 인접 달(이전 달 말·다음 달 초) 스필오버는 흐리게 표시한다.
// 좌/우 화살표로 가입월~현재월 범위 안에서만 달을 이동한다.
export function MonthlyStampModal({
  visible,
  initialYear,
  initialMonth,
  minYear,
  minMonth,
  maxYear,
  maxMonth,
  postDates,
  onClose,
}: MonthlyStampModalProps) {
  const [cursor, setCursor] = useState({year: initialYear, month: initialMonth});
  // 모달을 닫았다 다시 열면 기준 월로 되돌린다(이전에 넘겨 본 달이 남지 않게).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setCursor({year: initialYear, month: initialMonth});
    }
  }

  const postDateSet = useMemo(() => new Set(postDates), [postDates]);
  const weeks = useMemo(
    () => chunkIntoWeeks(buildMonthGrid(cursor.year, cursor.month, postDateSet)),
    [cursor, postDateSet],
  );

  const cursorOrdinal = monthOrdinal(cursor.year, cursor.month);
  const canGoPrev = cursorOrdinal > monthOrdinal(minYear, minMonth);
  const canGoNext = cursorOrdinal < monthOrdinal(maxYear, maxMonth);

  const goMonth = (delta: number) => {
    setCursor(current => shiftMonth(current.year, current.month, delta));
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      {visible ? (
        <Pressable
          accessibilityLabel="월간 도장 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        >
          {/* 카드 내부 터치가 배경 닫기로 전파되지 않도록 별도 Pressable로 감싼다. */}
          <Pressable
            accessibilityViewIsModal
            accessible={false}
            onPress={() => {}}
            style={styles.card}
          >
            <View style={styles.header}>
              <Pressable
                accessibilityLabel="이전 달"
                accessibilityRole="button"
                accessibilityState={{disabled: !canGoPrev}}
                disabled={!canGoPrev}
                hitSlop={8}
                onPress={() => goMonth(-1)}
                style={[styles.navButton, !canGoPrev && styles.navButtonDisabled]}
              >
                <MaterialDesignIcons
                  color={canGoPrev ? COLORS.textStrong : COLORS.inactive}
                  name="chevron-left"
                  size={24}
                />
              </Pressable>
              <Text style={styles.title}>
                {formatMonthTitle(cursor.year, cursor.month)}
              </Text>
              <Pressable
                accessibilityLabel="다음 달"
                accessibilityRole="button"
                accessibilityState={{disabled: !canGoNext}}
                disabled={!canGoNext}
                hitSlop={8}
                onPress={() => goMonth(1)}
                style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
              >
                <MaterialDesignIcons
                  color={canGoNext ? COLORS.textStrong : COLORS.inactive}
                  name="chevron-right"
                  size={24}
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

            <View style={styles.grid}>
              {weeks.map((week, weekIndex) => (
                <View key={`week-${weekIndex}`} style={styles.weekRow}>
                  {week.map(cell => (
                    <View key={cell.iso} style={styles.cell}>
                      <CarnationStamp
                        dimmed={!cell.inMonth}
                        filled={cell.filled}
                        size={38}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    gap: 16,
    padding: 24,
    width: '100%',
  },
  cell: {
    alignItems: 'center',
    flex: 1,
  },
  grid: {
    gap: 10,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  weekdayLabel: {
    color: COLORS.textSubtle,
    flex: 1,
    fontSize: 12,
    textAlign: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekRow: {
    flexDirection: 'row',
  },
});
