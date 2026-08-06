import {Phone} from "lucide-react-native";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText} from "../../../shared/components/AppText";

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
        <Phone
          color={COLORS.purpleDeep}
          size={30}
          strokeWidth={2.6}
        />
      </View>
      <AppText style={styles.time}>{call.startedAtLabel}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    backgroundColor: COLORS.lavenderSurface,
    transform: [{scale: 0.98}],
  },
  row: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderColor: COLORS.inactive,
    borderCurve: "continuous",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 3px 14px rgba(18, 23, 41, 0.055)',
    height: 132,
    justifyContent: "center",
    width: 100,
  },
  time: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
    marginTop: 12,
  },
  timeBadge: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: "continuous",
    borderRadius: RADII.pill,
    height: 54,
    justifyContent: "center",
    width: 54,
  },
});
