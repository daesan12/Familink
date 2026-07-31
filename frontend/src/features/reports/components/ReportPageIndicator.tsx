import { StyleSheet, View } from "react-native";

import { COLORS, RADII } from "../../../design/tokens";
import type { CareReceiverReportPage } from "../types";

interface ReportPageIndicatorProps {
  currentIndex: number;
  pages: readonly CareReceiverReportPage[];
}

export function ReportPageIndicator({
  currentIndex,
  pages,
}: ReportPageIndicatorProps) {
  return (
    <View
      accessibilityLabel={`피보호자 ${pages.length}명 중 ${
        currentIndex + 1
      }번째`}
      accessibilityRole="text"
      accessible
      style={styles.container}
    >
      {pages.map((page, index) => {
        const isActive = index === currentIndex;

        return (
          <View
            accessibilityLabel={`${page.displayName} 리포트${
              isActive ? ", 현재 화면" : ""
            }`}
            accessibilityState={{ selected: isActive }}
            key={page.memberId}
            style={[styles.dot, isActive && styles.activeDot]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  activeDot: {
    backgroundColor: COLORS.purpleDeep,
    transform: [{ scale: 1.2 }],
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 32,
  },
  dot: {
    backgroundColor: COLORS.inactive,
    borderRadius: RADII.pill,
    height: 8,
    width: 8,
  },
});
