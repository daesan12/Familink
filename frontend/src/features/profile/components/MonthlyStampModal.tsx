import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {RetryButton} from '../../../shared/components/RetryButton';
import {
  buildMonthGrid,
  chunkIntoWeeks,
  formatMonthTitle,
  monthOrdinal,
  shiftMonth,
  WEEKDAY_LABELS,
} from '../profileModel';
import {CarnationStamp} from './CarnationStamp';

export type MonthlyStampLoadState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {message: string; status: 'error'}
  | {status: 'empty'}
  | {earnedDates: readonly string[]; status: 'success'};

interface MonthlyStampModalProps {
  visible: boolean;
  year: number;
  month: number;
  minYear?: number;
  minMonth?: number;
  maxYear: number;
  maxMonth: number;
  state: MonthlyStampLoadState;
  onClose: () => void;
  onMonthChange: (year: number, month: number) => void;
  onRetry: () => void;
}

// I-5 월간 효자 도장 모달. 선택 월과 조회 상태를 부모가 관리하는 제어형 컴포넌트다.
// 인접 월 날짜는 달력 정렬을 위해서만 표시하며, 조회 결과로 도장을 채우지 않는다.
export function MonthlyStampModal({
  visible,
  year,
  month,
  minYear,
  minMonth,
  maxYear,
  maxMonth,
  state,
  onClose,
  onMonthChange,
  onRetry,
}: MonthlyStampModalProps) {
  const cursorOrdinal = monthOrdinal(year, month);
  const canGoPrev =
    minYear === undefined || minMonth === undefined
      ? true
      : cursorOrdinal > monthOrdinal(minYear, minMonth);
  const canGoNext = cursorOrdinal < monthOrdinal(maxYear, maxMonth);
  const earnedDates = state.status === 'success' ? state.earnedDates : [];
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
  const postDateSet = new Set(
    earnedDates.filter(date => date.startsWith(monthPrefix)),
  );
  const weeks = chunkIntoWeeks(buildMonthGrid(year, month, postDateSet));

  const goMonth = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    onMonthChange(next.year, next.month);
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
          accessibilityLabel="월간 효자 도장 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        >
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
              <AppText style={styles.title}>{formatMonthTitle(year, month)}</AppText>
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

            {state.status === 'idle' || state.status === 'loading' ? (
              <View
                accessibilityLabel="월간 카네이션 불러오는 중"
                style={styles.statusBlock}
              >
                <ActivityIndicator color={COLORS.purple} size="large" />
              </View>
            ) : state.status === 'error' ? (
              <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
                <AppText style={styles.errorText}>{state.message}</AppText>
                <RetryButton
                  accessibilityLabel="월간 카네이션 다시 시도"
                  onPress={onRetry}
                />
              </View>
            ) : (
              <>
                {state.status === 'empty' ? (
                  <AppText style={styles.emptyText}>이번 달에는 기록이 없어요.</AppText>
                ) : null}
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map(label => (
                    <AppText key={label} style={styles.weekdayLabel}>
                      {label}
                    </AppText>
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
              </>
            )}
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
  emptyText: {
    color: COLORS.textSubtle,
    fontSize: 14,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
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
  statusBlock: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 32,
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
