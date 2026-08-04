import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
              <Text accessibilityRole="header" style={styles.monthTitle}>
                {year}년 {month}월
              </Text>
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
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const date = formatDate(year, month, day);
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
                      <Text
                        style={[
                          styles.dayText,
                          isAvailable && styles.availableDayText,
                          isSelected && styles.selectedDayText,
                        ]}
                      >
                        {day}
                      </Text>
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
      <MaterialDesignIcons color={COLORS.background} name={icon} size={28} />
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
      <Text style={styles.statusText}>{message}</Text>
      {actionLabel && onAction ? (
        <RetryButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

function createCalendarDays(
  year: number,
  month: number
): readonly (number | null)[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const dayCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = Array.from(
    { length: firstWeekday },
    () => null
  );

  for (let day = 1; day <= dayCount; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
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
    backgroundColor: COLORS.textSubtle,
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
    minHeight: 330,
    padding: 24,
  },
  statusText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
});
