import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {
  useRef,
  useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import {AppText} from "../../../shared/components/AppText";

import { COLORS, RADII } from "../../../design/tokens";

const ROW_HEIGHT = 52;
const VISIBLE_ROWS = 3;
const MERIDIEMS = ["오전", "오후"] as const;
const HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0")
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0")
);

interface CalendarTimePickerModalProps {
  label: "시작" | "종료";
  onCancel: () => void;
  onConfirm: (time: string) => string | undefined;
  value: string;
  visible: boolean;
}

export function CalendarTimePickerModal({
  label,
  onCancel,
  onConfirm,
  value,
  visible,
}: CalendarTimePickerModalProps) {
  const initialTime = toPickerTime(value);
  const [meridiemIndex, setMeridiemIndex] = useState(initialTime.meridiemIndex);
  const [hourIndex, setHourIndex] = useState(initialTime.hourIndex);
  const [minuteIndex, setMinuteIndex] = useState(initialTime.minuteIndex);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null
  );

  const selectedTime = toTimeValue(meridiemIndex, hourIndex, minuteIndex);

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      {visible ? (
        <View style={styles.root}>
          <Pressable
            accessibilityLabel="시간 선택 취소"
            accessibilityRole="button"
            onPress={onCancel}
            style={styles.backdrop}
          />
          <View accessibilityViewIsModal accessible={false} style={styles.card}>
            <View style={styles.header}>
              <View style={styles.iconSurface}>
                <MaterialDesignIcons
                  color={COLORS.purpleDeep}
                  name="clock-outline"
                  size={23}
                />
              </View>
              <View style={styles.headerCopy}>
                <AppText accessibilityRole="header" style={styles.title}>
                  시간 설정
                </AppText>
                <AppText style={styles.description}>
                  {label} 시간을 선택해 주세요.
                </AppText>
              </View>
            </View>

            <View style={styles.wheelSurface}>
              <View pointerEvents="none" style={styles.selectionBand} />
              <WheelColumn
                accessibilityLabel="오전 오후 휠"
                accessibilitySuffix="선택"
                data={MERIDIEMS}
                onChange={(index) => {
                  setMeridiemIndex(index);
                  setValidationMessage(null);
                }}
                selectedIndex={meridiemIndex}
                width={82}
              />
              <WheelColumn
                accessibilityLabel="시 휠"
                accessibilitySuffix="시 선택"
                data={HOURS}
                onChange={(index) => {
                  setHourIndex(index);
                  setValidationMessage(null);
                }}
                selectedIndex={hourIndex}
                width={64}
              />
              <AppText style={styles.separator}>:</AppText>
              <WheelColumn
                accessibilityLabel="분 휠"
                accessibilitySuffix="분 선택"
                data={MINUTES}
                onChange={(index) => {
                  setMinuteIndex(index);
                  setValidationMessage(null);
                }}
                selectedIndex={minuteIndex}
                width={64}
              />
            </View>

            <AppText accessibilityLiveRegion="polite" style={styles.summary}>
              {label} 시간 {formatTimeLabel(selectedTime)}
            </AppText>
            {validationMessage ? (
              <AppText accessibilityRole="alert" style={styles.validationMessage}>
                {validationMessage}
              </AppText>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="시간 선택 취소"
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <AppText style={styles.cancelText}>취소</AppText>
              </Pressable>
              <Pressable
                accessibilityLabel="시간 선택 확인"
                accessibilityRole="button"
                onPress={() => {
                  const message = onConfirm(selectedTime);
                  if (message) {
                    setValidationMessage(message);
                  }
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.confirmButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <AppText style={styles.confirmText}>확인</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

function WheelColumn({
  accessibilityLabel,
  accessibilitySuffix,
  data,
  onChange,
  selectedIndex,
  width,
}: {
  accessibilityLabel: string;
  accessibilitySuffix: string;
  data: readonly string[];
  onChange: (index: number) => void;
  selectedIndex: number;
  width: number;
}) {
  const listRef = useRef<FlatList<string>>(null);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(
      0,
      Math.min(
        data.length - 1,
        Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT)
      )
    );
    onChange(nextIndex);
  };

  const handleSelect = (index: number) => {
    onChange(index);
    listRef.current?.scrollToIndex({ animated: true, index });
  };

  return (
    <FlatList
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      contentContainerStyle={styles.wheelContent}
      data={data}
      decelerationRate="fast"
      getItemLayout={(_, index) => ({
        index,
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
      })}
      initialScrollIndex={selectedIndex}
      keyExtractor={(item) => item}
      onMomentumScrollEnd={handleScrollEnd}
      onScrollEndDrag={(event) => {
        if (!event.nativeEvent.velocity?.y) {
          handleScrollEnd(event);
        }
      }}
      ref={listRef}
      renderItem={({ item, index }) => {
        const selected = index === selectedIndex;
        return (
          <Pressable
            accessibilityLabel={`${item}${accessibilitySuffix}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => handleSelect(index)}
            style={styles.wheelItem}
          >
            <AppText
              style={selected ? styles.selectedWheelText : styles.wheelText}
            >
              {item}
            </AppText>
          </Pressable>
        );
      }}
      showsVerticalScrollIndicator={false}
      snapToAlignment="start"
      snapToInterval={ROW_HEIGHT}
      style={[styles.wheel, { width }]}
    />
  );
}

function toPickerTime(value: string): {
  hourIndex: number;
  meridiemIndex: number;
  minuteIndex: number;
} {
  const [hourValue = "0", minuteValue = "0"] = value.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  return {
    hourIndex: (hour + 11) % 12,
    meridiemIndex: hour >= 12 ? 1 : 0,
    minuteIndex: Math.max(0, Math.min(59, minute)),
  };
}

function toTimeValue(
  meridiemIndex: number,
  hourIndex: number,
  minuteIndex: number
): string {
  const twelveHour = hourIndex + 1;
  const hour =
    meridiemIndex === 1
      ? twelveHour === 12
        ? 12
        : twelveHour + 12
      : twelveHour === 12
      ? 0
      : twelveHour;
  return `${String(hour).padStart(2, "0")}:${String(minuteIndex).padStart(
    2,
    "0"
  )}`;
}

function formatTimeLabel(value: string): string {
  const { hourIndex, meridiemIndex, minuteIndex } = toPickerTime(value);
  return `${MERIDIEMS[meridiemIndex]} ${HOURS[hourIndex]}:${MINUTES[minuteIndex]}`;
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: RADII.small,
    flex: 1,
    justifyContent: "center",
    minHeight: 50,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  backdrop: {
    backgroundColor: COLORS.overlay,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  cancelButton: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.divider,
    borderWidth: 1,
  },
  cancelText: {
    color: COLORS.purpleDeep,
    fontSize: 15,
    fontWeight: "800",
  },
  card: {
    backgroundColor: COLORS.background,
    borderCurve: "continuous",
    borderRadius: RADII.sheet,
    padding: 24,
    width: "100%",
  },
  confirmButton: {
    backgroundColor: COLORS.purpleDeep,
  },
  confirmText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: "800",
  },
  description: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  iconSurface: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.small,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  root: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  selectedWheelText: {
    color: COLORS.purpleDeep,
    fontSize: 22,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  selectionBand: {
    backgroundColor: COLORS.lavenderSurface,
    borderColor: COLORS.lavender,
    borderRadius: RADII.small,
    borderWidth: 1,
    height: ROW_HEIGHT,
    left: 8,
    position: "absolute",
    right: 8,
    top: ROW_HEIGHT,
  },
  separator: {
    alignSelf: "center",
    color: COLORS.purpleDeep,
    fontSize: 22,
    fontWeight: "800",
    marginHorizontal: 2,
    marginTop: 1,
  },
  summary: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    marginTop: 12,
    textAlign: "center",
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: "800",
  },
  validationMessage: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    textAlign: "center",
  },
  wheel: {
    flexGrow: 0,
    height: ROW_HEIGHT * VISIBLE_ROWS,
  },
  wheelContent: {
    paddingVertical: ROW_HEIGHT,
  },
  wheelItem: {
    alignItems: "center",
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  wheelSurface: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    flexDirection: "row",
    height: ROW_HEIGHT * VISIBLE_ROWS,
    justifyContent: "center",
    marginTop: 22,
    overflow: "hidden",
    paddingHorizontal: 8,
    width: "100%",
  },
  wheelText: {
    color: COLORS.textSubtle,
    fontSize: 17,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
});
