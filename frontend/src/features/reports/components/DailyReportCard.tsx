import { StyleSheet, Text, View } from "react-native";

import { COLORS, RADII } from "../../../design/tokens";
import type { DailyReportView } from "../types";

interface DailyReportCardProps {
  report: DailyReportView;
}

export function DailyReportCard({ report }: DailyReportCardProps) {
  return (
    <View
      accessibilityLabel={`${report.reportDateLabel} 일간 리포트`}
      style={styles.card}
    >
      <View style={styles.heading}>
        <View
          accessibilityLabel={`기분 ${report.emotion.label}`}
          style={styles.emotionBadge}
        >
          <Text style={styles.emoji}>{report.emotion.emoji}</Text>
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>일간 리포트</Text>
          <Text style={styles.emotionLabel}>{report.emotion.label}</Text>
        </View>
        <Text style={styles.date}>{report.reportDateLabel}</Text>
      </View>

      <Text style={styles.summary}>{report.summary}</Text>

      {report.guardianMessageSummary ? (
        <View style={styles.messageCard}>
          <Text style={styles.messageTitle}>전달할 말씀</Text>
          <Text style={styles.messageBody}>
            {report.guardianMessageSummary}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: "continuous",
    borderRadius: RADII.sheet,
    padding: 20,
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  emotionBadge: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderCurve: "continuous",
    borderRadius: RADII.pill,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  emotionLabel: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  emoji: {
    fontSize: 29,
    lineHeight: 36,
  },
  eyebrow: {
    color: COLORS.purpleDeep,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 18,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  headingCopy: {
    flex: 1,
  },
  messageBody: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 5,
  },
  messageCard: {
    backgroundColor: COLORS.lemon,
    borderCurve: "continuous",
    borderRadius: RADII.medium,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messageTitle: {
    color: COLORS.textStrong,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  summary: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 18,
  },
});
