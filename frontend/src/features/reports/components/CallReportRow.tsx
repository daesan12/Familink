import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, RADII } from "../../../design/tokens";
import type { CallReportView } from "../types";

interface CallReportRowProps {
  call: CallReportView;
  onPress: (call: CallReportView) => void;
}

export function CallReportRow({ call, onPress }: CallReportRowProps) {
  const isAvailable = call.reportAvailable;

  return (
    <Pressable
      accessibilityLabel={`${call.startedAtLabel} 통화 리포트${
        isAvailable ? " 열기" : " 상태 확인"
      }`}
      accessibilityRole="button"
      onPress={() => onPress(call)}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.timeBadge}>
        <MaterialDesignIcons
          color={COLORS.purpleDeep}
          name="phone-outline"
          size={20}
        />
      </View>
      <View style={styles.copy}>
        <Text style={styles.time}>{call.startedAtLabel}</Text>
        <Text style={styles.caption}>
          {isAvailable ? "통화 리포트" : "리포트 준비 중"}
        </Text>
      </View>
      <MaterialDesignIcons
        color={COLORS.textSubtle}
        name="chevron-right"
        size={25}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  caption: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  copy: {
    flex: 1,
  },
  pressed: {
    backgroundColor: COLORS.lavenderSurface,
  },
  row: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: "continuous",
    borderRadius: RADII.medium,
    borderWidth: 1,
    flexDirection: "row",
    gap: 13,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  time: {
    color: COLORS.textStrong,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
  },
  timeBadge: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: "continuous",
    borderRadius: RADII.pill,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
});
