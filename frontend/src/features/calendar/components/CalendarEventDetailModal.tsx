import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, RADII } from "../../../design/tokens";
import { formatEventDateRange, formatEventTime } from "../calendarModel";
import type { CalendarEventDetail, CalendarMember } from "../types";

const PROFILE_PLACEHOLDER = require("../../../assets/images/profile-placeholder.png");

interface CalendarEventDetailModalProps {
  canManage: boolean;
  deleteErrorMessage: string | null;
  deleting: boolean;
  detail: CalendarEventDetail | null;
  errorMessage: string | null;
  loading: boolean;
  members: readonly CalendarMember[];
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRetry: () => void;
  visible: boolean;
}

export function CalendarEventDetailModal({
  canManage,
  deleteErrorMessage,
  deleting,
  detail,
  errorMessage,
  loading,
  members,
  onClose,
  onDelete,
  onEdit,
  onRetry,
  visible,
}: CalendarEventDetailModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={() => {
        if (!deleting) {
          onClose();
        }
      }}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="일정 상세 닫기"
          accessibilityRole="button"
          disabled={deleting}
          onPress={onClose}
          style={styles.dim}
        />
        <View style={styles.card}>
          <Pressable
            accessibilityLabel="일정 상세 닫기"
            accessibilityRole="button"
            disabled={deleting}
            onPress={onClose}
            style={[styles.closeButton, deleting && styles.actionDisabled]}
          >
            <MaterialDesignIcons
              color={COLORS.textMuted}
              name="close"
              size={22}
            />
          </Pressable>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={COLORS.purpleDeep} size="large" />
              <Text style={styles.stateDescription}>
                일정 내용을 불러오고 있어요.
              </Text>
            </View>
          ) : errorMessage ? (
            <View style={styles.centerState}>
              <MaterialDesignIcons
                color={COLORS.error}
                name="alert-circle-outline"
                size={34}
              />
              <Text style={styles.stateTitle}>상세를 불러오지 못했어요</Text>
              <Text style={styles.stateDescription}>{errorMessage}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={onRetry}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : detail ? (
            <View style={styles.detailLayout}>
              <ScrollView
                contentContainerStyle={styles.detailScrollContent}
                showsVerticalScrollIndicator={false}
                style={styles.detailScroll}
              >
                <Text style={styles.title}>{detail.title}</Text>
                <View style={styles.schedule}>
                  <MaterialDesignIcons
                    accessibilityElementsHidden
                    color={COLORS.purpleDeep}
                    name="calendar-blank-outline"
                    size={20}
                  />
                  <View style={styles.scheduleText}>
                    <Text style={styles.dateText}>
                      {formatEventDateRange(detail)}
                    </Text>
                    <Text style={styles.timeText}>
                      {formatEventTime(detail)}
                    </Text>
                  </View>
                </View>

                <View style={styles.descriptionCard}>
                  <Text style={styles.sectionLabel}>세부 내용</Text>
                  <Text style={styles.description}>
                    {detail.description.trim() || "세부 내용이 없어요."}
                  </Text>
                </View>

                <PeopleSection
                  label="작성자"
                  memberIds={[detail.creatorMemberId]}
                  members={members}
                />
                <PeopleSection
                  emptyLabel="참여자가 없어요."
                  label="참여자"
                  memberIds={detail.participantMemberIds}
                  members={members}
                />
              </ScrollView>

              {canManage && deleteErrorMessage ? (
                <Text accessibilityRole="alert" style={styles.deleteError}>
                  {deleteErrorMessage}
                </Text>
              ) : null}
              {canManage ? (
                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityLabel="일정 수정"
                    accessibilityRole="button"
                    disabled={deleting}
                    onPress={onEdit}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.editButton,
                      pressed && styles.actionPressed,
                      deleting && styles.actionDisabled,
                    ]}
                  >
                    <MaterialDesignIcons
                      color={COLORS.purpleDeep}
                      name="pencil-outline"
                      size={20}
                    />
                    <Text style={styles.editButtonText}>수정</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="일정 삭제"
                    accessibilityRole="button"
                    disabled={deleting}
                    onPress={onDelete}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.deleteButton,
                      pressed && styles.actionPressed,
                      deleting && styles.actionDisabled,
                    ]}
                  >
                    {deleting ? (
                      <ActivityIndicator color={COLORS.error} size="small" />
                    ) : (
                      <MaterialDesignIcons
                        color={COLORS.error}
                        name="delete-outline"
                        size={20}
                      />
                    )}
                    <Text style={styles.deleteButtonText}>
                      {deleting ? "삭제 중" : "삭제"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function PeopleSection({
  emptyLabel,
  label,
  memberIds,
  members,
}: {
  emptyLabel?: string;
  label: string;
  memberIds: readonly string[];
  members: readonly CalendarMember[];
}) {
  return (
    <View style={styles.peopleSection}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {memberIds.length === 0 ? (
        <Text style={styles.emptyPeople}>{emptyLabel}</Text>
      ) : (
        <View style={styles.peopleList}>
          {memberIds.map((memberId) => {
            const member = members.find((item) => item.memberId === memberId);
            return (
              <View key={memberId} style={styles.personChip}>
                <Image
                  accessibilityLabel={
                    member
                      ? `${member.displayName} 프로필 사진`
                      : "기본 프로필 사진"
                  }
                  source={
                    member?.profileImageUrl
                      ? { uri: member.profileImageUrl }
                      : PROFILE_PLACEHOLDER
                  }
                  style={styles.avatar}
                />
                <Text numberOfLines={1} style={styles.personName}>
                  {member?.displayName ?? `구성원 ${memberId}`}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: RADII.medium,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  actionPressed: {
    opacity: 0.72,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  avatar: {
    borderRadius: RADII.pill,
    height: 32,
    width: 32,
  },
  card: {
    backgroundColor: COLORS.background,
    borderRadius: RADII.sheet,
    height: "78%",
    minHeight: 360,
    padding: 24,
    width: "88%",
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 300,
    paddingHorizontal: 16,
  },
  closeButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    borderRadius: RADII.pill,
    height: 44,
    justifyContent: "center",
    marginRight: -10,
    marginTop: -10,
    width: 44,
  },
  dateText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  description: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  descriptionCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.medium,
    marginTop: 22,
    minHeight: 112,
    padding: 16,
  },
  deleteButton: {
    backgroundColor: "#FFF4F2",
    borderColor: "#F3B8B2",
  },
  deleteButtonText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: "800",
  },
  deleteError: {
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center",
  },
  detailLayout: {
    flex: 1,
  },
  detailScroll: {
    flex: 1,
  },
  detailScrollContent: {
    paddingBottom: 4,
  },
  dim: {
    backgroundColor: "rgba(18, 23, 41, 0.48)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  emptyPeople: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 10,
  },
  editButton: {
    backgroundColor: COLORS.lavenderSurface,
    borderColor: COLORS.lavender,
  },
  editButtonText: {
    color: COLORS.purpleDeep,
    fontSize: 15,
    fontWeight: "800",
  },
  modalRoot: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  peopleList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  peopleSection: {
    marginTop: 22,
  },
  personChip: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    flexDirection: "row",
    gap: 8,
    maxWidth: "100%",
    minHeight: 42,
    paddingHorizontal: 6,
    paddingRight: 12,
  },
  personName: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: "700",
    maxWidth: 150,
  },
  retryButton: {
    backgroundColor: COLORS.purpleDeep,
    borderRadius: RADII.pill,
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "700",
  },
  schedule: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  scheduleText: {
    flex: 1,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  stateDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  stateTitle: {
    color: COLORS.textStrong,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 14,
  },
  timeText: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 31,
  },
});
