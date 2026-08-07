import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {StyleSheet, View} from "react-native";
import {AppText} from "../../../shared/components/AppText";

import { COLORS, RADII } from "../../../design/tokens";
import type { DailyReportView } from "../types";
import {ReportMessageBubble} from "./ReportMessageBubble";

interface DailyReportCardProps {
  report: DailyReportView;
}

export function DailyReportCard({ report }: DailyReportCardProps) {
  return (
    <View
      accessibilityLabel={`${report.reportDateLabel} 일간 리포트`}
      style={[
        styles.card,
        report.guardianMessageSummary ? styles.cardWithMessage : null,
      ]}
    >
      <View style={styles.heading}>
        <View style={styles.reportBadge}>
          <AppText style={styles.reportBadgeText}>일간 리포트</AppText>
        </View>
        <View
          accessibilityLabel={`기분 ${report.emotion.label}`}
          style={styles.emotion}
        >
          <AppText style={styles.emotionLabel}>{report.emotion.label}</AppText>
          <MaterialDesignIcons
            color={COLORS.text}
            name={report.emotion.icon}
            size={38}
          />
        </View>
      </View>

      <AppText style={styles.summary}>{report.summary}</AppText>

      {report.guardianMessageSummary ? (
        <View style={styles.messageBubbleWrap}>
          <ReportMessageBubble
            message={report.guardianMessageSummary}
            minHeight={82}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F3EFF5',
    experimental_backgroundImage:
      'linear-gradient(115deg, #EEE8FF 0%, #F4EFF5 52%, #FFF7DE 100%)',
    borderCurve: "continuous",
    borderRadius: RADII.sheet,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  cardWithMessage: {
    minHeight: 286,
  },
  emotion: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  emotionLabel: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 29,
  },
  heading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  messageBubbleWrap: {
    marginTop: 20,
  },
  reportBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderCurve: "continuous",
    borderRadius: RADII.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  reportBadgeText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 20,
  },
  summary: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 32,
  },
});
