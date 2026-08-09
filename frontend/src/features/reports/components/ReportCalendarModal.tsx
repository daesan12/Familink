import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {AppText} from "../../../shared/components/AppText";

import { COLORS, RADII } from "../../../design/tokens";
import { RetryButton } from "../../../shared/components/RetryButton";

export type ReportCalendarStatus = "loading" | "ready" | "error";

interface ReportCalendarModalProps {
  month: number;
  onClose: () => void;
  onNextMonth: () => void;
  onPreviousMonth: () => void;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
  reportDates: readonly string[];
  selectedDate: string;
  status: ReportCalendarStatus;
  visible: boolean;
  year: number;
}

export function ReportCalendarModal({
  month,
  onClose,
  onNextMonth,
  onPreviousMonth,
  onRetry,
  onSelectDate,
  reportDates,
  selectedDate,
  status,
  visible,
  year,
}: ReportCalendarModalProps) {
  const availableDates = new Set(reportDates);
  const calendarDays = createCalendarDays(year, month);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View
        accessibilityLabel="리포트 날짜 선택"
        accessibilityViewIsModal
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="리포트 캘린더 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.card}>
          <View style={styles.header}>
            <MonthButton
              accessibilityLabel="이전 달"
              icon="chevron-left"
              onPress={onPreviousMonth}
            />
            <View style={styles.monthTitleContainer}>
              <AppText accessibilityRole="header" style={styles.monthTitle}>
                {year}년 {month}월
              </AppText>
              {status === "loading" ? (
                <ActivityIndicator
                  accessibilityLabel="리포트 날짜 확인 중"
                  color={COLORS.purpleDeep}
                  size="small"
                  style={styles.monthLoading}
                />
              ) : null}
            </View>
            <MonthButton
              accessibilityLabel="다음 달"
              icon="chevron-right"
              onPress={onNextMonth}
            />
          </View>

          <View style={styles.divider} />

          {status === "error" ? (
            <CalendarStatus
              actionLabel="다시 시도"
              icon="alert-circle-outline"
              message="리포트 날짜를 불러오지 못했어요."
              onAction={onRetry}
            />
          ) : null}

          {status !== "error" ? (
            <View style={styles.calendarGrid}>
              {calendarDays.map((cell) => {
                // 인접 달 칸은 7열 정렬용이므로 흐리게만 보여 주고 버튼으로 만들지
                // 않는다. 여기서 걸러야 아래 라벨의 `${year}년 ${month}월`이 맞다.
                // 월 정보가 없는 숫자만 읽히면 혼란스러워 접근성 트리에서 감춘다.
                if (!cell.inMonth) {
                  return (
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      key={cell.date}
                      style={styles.dayCell}
                    >
                      <AppText style={[styles.dayText, styles.outsideDayText]}>
                        {cell.day}
                      </AppText>
                    </View>
                  );
                }

                const day = cell.day;
                const date = cell.date;
                const isAvailable = availableDates.has(date);
                const isSelected = isAvailable && selectedDate === date;

                return (
                  <View key={date} style={styles.dayCell}>
                    <Pressable
                      accessibilityLabel={
                        isAvailable
                          ? `${year}년 ${month}월 ${day}일 리포트 보기`
                          : `${year}년 ${month}월 ${day}일 리포트 없음`
                      }
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: !isAvailable,
                        selected: isSelected,
                      }}
                      disabled={!isAvailable}
                      onPress={() => onSelectDate(date)}
                      style={[
                        styles.dayButton,
                        isAvailable && styles.availableDay,
                        isSelected && styles.selectedDay,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.dayText,
                          isAvailable && styles.availableDayText,
                          isSelected && styles.selectedDayText,
                        ]}
                      >
                        {day}
                      </AppText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

interface MonthButtonProps {
  accessibilityLabel: string;
  icon: "chevron-left" | "chevron-right";
  onPress: () => void;
}

function MonthButton({ accessibilityLabel, icon, onPress }: MonthButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.monthButton}
    >
      <MaterialDesignIcons color={COLORS.purpleDeep} name={icon} size={28} />
    </Pressable>
  );
}

interface CalendarStatusProps {
  actionLabel?: string;
  icon: "alert-circle-outline" | "clock-outline";
  message: string;
  onAction?: () => void;
}

function CalendarStatus({
  actionLabel,
  icon,
  message,
  onAction,
}: CalendarStatusProps) {
  return (
    <View style={styles.status}>
      <MaterialDesignIcons color={COLORS.purpleDeep} name={icon} size={30} />
      <AppText style={styles.statusText}>{message}</AppText>
      {actionLabel && onAction ? (
        <RetryButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

// 달력 격자는 항상 6주 42칸으로 고정한다.
const CALENDAR_CELL_COUNT = 42;

interface CalendarCell {
  date: string;
  day: number;
  // 이 칸이 기준 달에 속하는지 여부. false면 인접 달 스필오버(흐리게, 선택 불가).
  inMonth: boolean;
}

// 6주 42칸 고정이라 월마다 팝업 높이가 달라지지 않는다. 앞뒤 여유 칸은 인접 달의
// 실제 날짜로 채우며, date는 표시 중인 달이 아니라 각 칸 자신의 연·월로 만든다.
function createCalendarDays(
  year: number,
  month: number
): readonly CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < CALENDAR_CELL_COUNT; index += 1) {
    // Date.UTC가 범위를 벗어난 일(day) 값을 인접 달로 이월해 준다.
    const date = new Date(Date.UTC(year, month - 1, index - firstWeekday + 1));
    const cellYear = date.getUTCFullYear();
    const cellMonth = date.getUTCMonth() + 1;
    cells.push({
      date: formatDate(cellYear, cellMonth, date.getUTCDate()),
      day: date.getUTCDate(),
      inMonth: cellYear === year && cellMonth === month,
    });
  }

  return cells;
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
    2,
    "0"
  )}`;
}

const styles = StyleSheet.create({
  availableDay: {
    backgroundColor: "#EEEEEE",
  },
  availableDayText: {
    color: COLORS.textMuted,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingBottom: 24,
    paddingHorizontal: 10,
    paddingTop: 12,
  },
  card: {
    backgroundColor: COLORS.background,
    borderCurve: "continuous",
    borderRadius: 20,
    maxWidth: 390,
    overflow: "hidden",
    width: "88%",
  },
  dayButton: {
    alignItems: "center",
    borderRadius: RADII.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  dayCell: {
    alignItems: "center",
    height: 58,
    justifyContent: "center",
    width: "14.2857%",
  },
  dayText: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  divider: {
    backgroundColor: COLORS.border,
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    height: 66,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  monthButton: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  monthTitle: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 30,
  },
  monthTitleContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  monthLoading: {
    left: "100%",
    marginLeft: 8,
    position: "absolute",
  },
  outsideDayText: {
    color: COLORS.textDisabled,
  },
  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(18, 23, 41, 0.58)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  selectedDay: {
    backgroundColor: COLORS.textSubtle,
  },
  selectedDayText: {
    color: COLORS.background,
  },
  status: {
    alignItems: "center",
    gap: 14,
    justifyContent: "center",
    // 6주 격자(58*6 + calendarGrid의 paddingTop 12 + paddingBottom 24)와 같은 높이라야
    // error ↔ ready 전환에서 카드가 튀지 않는다.
    minHeight: 384,
    padding: 24,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
