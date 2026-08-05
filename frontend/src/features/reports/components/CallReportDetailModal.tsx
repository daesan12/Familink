import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import type { ComponentProps } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, RADII } from "../../../design/tokens";
import { RetryButton } from "../../../shared/components/RetryButton";
import type { CallReportDetailState } from "../types";

interface CallReportDetailModalProps {
  detail: CallReportDetailState | null;
  onClose: () => void;
  onRetry: () => void;
}

export function CallReportDetailModal({
  detail,
  onClose,
  onRetry,
}: CallReportDetailModalProps) {
  const call = detail?.call ?? null;

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={detail !== null}
    >
      <View
        accessibilityLabel="건별 통화 리포트 상세"
        accessibilityViewIsModal
        style={styles.overlay}
      >
        <Pressable
          accessibilityLabel="통화 리포트 상세 닫기"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {detail && call ? (
          <View style={styles.modalCard}>
            <View style={styles.header}>
              <View style={styles.titleCopy}>
                <Text style={styles.date}>{call.reportDateLabel}</Text>
                <Text style={styles.title}>
                  {call.startedAtLabel} 통화 리포트
                </Text>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={styles.closeButton}
              >
                <MaterialDesignIcons
                  color={COLORS.textStrong}
                  name="close"
                  size={25}
                />
              </Pressable>
            </View>

            {detail.status === "loading" ? (
              <DetailStatus
                description="통화 내용을 불러오고 있어요."
                icon="clock-outline"
                title="리포트 조회 중"
              />
            ) : null}

            {detail.status === "generating" ? (
              <DetailStatus
                description="통화가 끝난 뒤 서버에서 내용을 정리하고 있어요."
                icon="clock-outline"
                title="리포트를 준비하고 있어요"
              />
            ) : null}

            {detail.status === "delayed" ? (
              <DetailStatus
                actionLabel="상태 다시 확인"
                description="처리는 계속될 수 있어요. 잠시 후 상태를 다시 확인해 주세요."
                icon="clock-alert-outline"
                onAction={onRetry}
                title="처리가 예상보다 오래 걸리고 있어요"
              />
            ) : null}

            {detail.status === "failed" ? (
              <DetailStatus
                description="리포트 생성 중 문제가 발생했어요. 자동으로 다시 생성되지는 않아요."
                icon="alert-circle-outline"
                title="리포트 생성에 실패했어요"
              />
            ) : null}

            {detail.status === "unavailable" ? (
              <DetailStatus
                description="통화 상태나 전사 내용을 확인할 수 없어 이 리포트를 만들 수 없어요."
                icon="file-remove-outline"
                title="생성할 수 없는 리포트예요"
              />
            ) : null}

            {detail.status === "error" ? (
              <DetailStatus
                actionLabel="상태 다시 확인"
                description="네트워크 연결을 확인한 뒤 상태를 다시 확인해 주세요."
                icon="alert-circle-outline"
                onAction={onRetry}
                title="리포트 상태를 확인하지 못했어요"
              />
            ) : null}

            {detail.status === "ready" ? (
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.summaryCard}>
                  <Text style={styles.sectionTitle}>통화 내용</Text>
                  <Text style={styles.body}>{call.summary}</Text>
                </View>

                {call.guardianMessage ? (
                  <View style={styles.messageCard}>
                    <Text style={styles.sectionTitle}>전달하신 말씀</Text>
                    <Text style={styles.body}>{call.guardianMessage}</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

interface DetailStatusProps {
  actionLabel?: string;
  description: string;
  icon: ComponentProps<typeof MaterialDesignIcons>["name"];
  onAction?: () => void;
  title: string;
}

function DetailStatus({
  actionLabel,
  description,
  icon,
  onAction,
  title,
}: DetailStatusProps) {
  return (
    <View style={styles.status}>
      <MaterialDesignIcons color={COLORS.purpleDeep} name={icon} size={30} />
      <Text style={styles.statusTitle}>{title}</Text>
      <Text style={styles.statusDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <RetryButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
  },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  content: {
    gap: 14,
    paddingTop: 20,
  },
  date: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  messageCard: {
    backgroundColor: COLORS.lemon,
    borderCurve: "continuous",
    borderRadius: RADII.medium,
    padding: 18,
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderCurve: "continuous",
    borderRadius: RADII.sheet,
    maxHeight: "78%",
    padding: 22,
    width: "88%",
  },
  overlay: {
    alignItems: "center",
    backgroundColor: COLORS.imageOverlay,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  sectionTitle: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  summaryCard: {
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: "continuous",
    borderRadius: RADII.medium,
    padding: 18,
  },
  status: {
    alignItems: "center",
    minHeight: 220,
    paddingHorizontal: 16,
    paddingTop: 44,
  },
  statusDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  statusTitle: {
    color: COLORS.textStrong,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 24,
    marginTop: 14,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 28,
    marginTop: 3,
  },
  titleCopy: {
    flex: 1,
  },
});
