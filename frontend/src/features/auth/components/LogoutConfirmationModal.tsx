import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

import { AUTH_COLORS } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";

interface LogoutConfirmationModalProps {
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  visible: boolean;
}

export function LogoutConfirmationModal({
  onCancel,
  onConfirm,
  visible,
}: LogoutConfirmationModalProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = () => {
    if (submitting) {
      return;
    }

    setSubmitting(true);
    onConfirm().catch(() => setSubmitting(false));
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modal}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityLabel="로그아웃 확인"
          accessibilityViewIsModal
          style={styles.card}
        >
          <AnimatedPressable
            accessibilityLabel="로그아웃 창 닫기"
            accessibilityRole="button"
            containerStyle={styles.closeButton}
            hitSlop={10}
            onPress={onCancel}
          >
            <MaterialDesignIcons
              color={AUTH_COLORS.muted}
              name="close"
              size={28}
            />
          </AnimatedPressable>

          <Text style={styles.title}>잠시만요</Text>
          <Text style={styles.message}>이 계정에서 로그아웃할까요?</Text>

          <View style={styles.actions}>
            <AnimatedPressable
              accessibilityLabel="로그아웃 취소"
              accessibilityRole="button"
              containerStyle={styles.actionContainer}
              disabled={submitting}
              onPress={onCancel}
            >
              <View style={[styles.action, styles.cancelAction]}>
                <Text style={styles.cancelLabel}>취소</Text>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              accessibilityLabel="로그아웃 확인하기"
              accessibilityRole="button"
              accessibilityState={{ busy: submitting }}
              containerStyle={styles.actionContainer}
              disabled={submitting}
              onPress={handleConfirm}
            >
              <View style={[styles.action, styles.confirmAction]}>
                {submitting ? (
                  <ActivityIndicator color={AUTH_COLORS.primaryDeep} />
                ) : (
                  <Text style={styles.confirmLabel}>로그아웃</Text>
                )}
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.54)",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    alignItems: "center",
    backgroundColor: AUTH_COLORS.background,
    borderRadius: 28,
    boxShadow: "0px 16px 36px rgba(15, 23, 42, 0.18)",
    maxWidth: 380,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 54,
    width: "100%",
  },
  closeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 14,
    top: 12,
    width: 44,
  },
  title: {
    color: "#5D4598",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  message: {
    color: AUTH_COLORS.black,
    fontSize: 17,
    letterSpacing: -0.2,
    lineHeight: 26,
    marginTop: 14,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 30,
    width: "100%",
  },
  actionContainer: {
    flex: 1,
  },
  action: {
    alignItems: "center",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
  },
  cancelAction: {
    backgroundColor: AUTH_COLORS.action,
    boxShadow: "0px 6px 14px rgba(177, 145, 53, 0.12)",
  },
  confirmAction: {
    backgroundColor: AUTH_COLORS.primarySoft,
    boxShadow: "0px 6px 14px rgba(102, 83, 188, 0.14)",
  },
  cancelLabel: {
    color: AUTH_COLORS.body,
    fontSize: 18,
    fontWeight: "700",
  },
  confirmLabel: {
    color: "#5D4598",
    fontSize: 18,
    fontWeight: "800",
  },
});
