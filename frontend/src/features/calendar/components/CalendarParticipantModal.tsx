import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADII } from "../../../design/tokens";
import { CachedRemoteImage } from "../../../shared/media/CachedRemoteImage";
import type { CalendarMember } from "../types";

const PROFILE_PLACEHOLDER = require("../../../assets/images/profile-placeholder.png");

interface CalendarParticipantModalProps {
  members: readonly CalendarMember[];
  onChange: (memberIds: readonly string[]) => void;
  onClose: () => void;
  selectedMemberIds: readonly string[];
  visible: boolean;
}

export function CalendarParticipantModal({
  members,
  onChange,
  onClose,
  selectedMemberIds,
  visible,
}: CalendarParticipantModalProps) {
  const insets = useSafeAreaInsets();
  const toggleMember = (memberId: string) => {
    onChange(
      selectedMemberIds.includes(memberId)
        ? selectedMemberIds.filter((id) => id !== memberId)
        : [...selectedMemberIds, memberId]
    );
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="참여자 선택 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.dim}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              참여자 선택
            </Text>
            <Pressable
              accessibilityLabel="참여자 선택 완료"
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.doneText}>완료</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list}>
            {members.length === 0 ? (
              <Text style={styles.emptyText}>
                선택할 수 있는 그룹 구성원이 없어요.
              </Text>
            ) : (
              members.map((member) => {
                const selected = selectedMemberIds.includes(member.memberId);
                return (
                  <Pressable
                    accessibilityLabel={`${member.displayName} 참여자 ${
                      selected ? "해제" : "선택"
                    }`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={member.memberId}
                    onPress={() => toggleMember(member.memberId)}
                    style={({ pressed }) => [
                      styles.memberRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <CachedRemoteImage
                      source={
                        member.profileImageUrl
                          ? { uri: member.profileImageUrl }
                          : PROFILE_PLACEHOLDER
                      }
                      style={styles.avatar}
                    />
                    <View style={styles.memberText}>
                      <Text style={styles.memberName}>
                        {member.displayName}
                      </Text>
                      <Text style={styles.memberRole}>
                        {member.role === "careReceiver" ? "피보호자" : "보호자"}
                        {member.isManager ? " · 관리자" : ""}
                      </Text>
                    </View>
                    <MaterialDesignIcons
                      color={selected ? COLORS.purpleDeep : COLORS.inactive}
                      name={
                        selected ? "checkbox-marked-circle" : "circle-outline"
                      }
                      size={26}
                    />
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: RADII.pill,
    height: 42,
    width: 42,
  },
  dim: {
    backgroundColor: COLORS.overlay,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  doneButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 52,
  },
  doneText: {
    color: COLORS.purpleDeep,
    fontSize: 15,
    fontWeight: "800",
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
    paddingVertical: 30,
    textAlign: "center",
  },
  handle: {
    alignSelf: "center",
    backgroundColor: COLORS.inactive,
    borderRadius: RADII.pill,
    height: 4,
    marginTop: 10,
    width: 40,
  },
  header: {
    alignItems: "center",
    borderBottomColor: COLORS.divider,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 62,
    paddingHorizontal: 20,
  },
  list: {
    paddingBottom: 24,
  },
  memberName: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: "700",
  },
  memberRole: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  memberRow: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 66,
    paddingHorizontal: 20,
  },
  memberText: {
    flex: 1,
    marginLeft: 12,
  },
  pressed: {
    opacity: 0.68,
  },
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    maxHeight: "72%",
    minHeight: 260,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: "800",
  },
});
