import {
  useEffect,
  useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import {AppText} from "../../../shared/components/AppText";
import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";

import { AUTH_COLORS } from "../theme";
import { AnimatedPressable } from "./AnimatedPressable";

export type AccountAction = "logout" | "withdrawal";

interface AccountActionConfirmationModalProps {
  action?: AccountAction;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  visible: boolean;
}

const ACTION_COPY: Record<
  AccountAction,
  {
    cancelLabel: string;
    confirmButtonLabel: string;
    confirmText: string;
    dialogLabel: string;
    message: string;
    title: string;
    closeLabel: string;
  }
> = {
  logout: {
    cancelLabel: "로그아웃 취소",
    closeLabel: "로그아웃 창 닫기",
    confirmButtonLabel: "로그아웃 확인하기",
    confirmText: "로그아웃",
    dialogLabel: "로그아웃 확인",
    message: "이 계정에서 로그아웃할까요?",
    title: "잠시만요",
  },
  withdrawal: {
    cancelLabel: "회원탈퇴 취소",
    closeLabel: "회원탈퇴 창 닫기",
    confirmButtonLabel: "회원탈퇴 확인하기",
    confirmText: "회원탈퇴",
    dialogLabel: "회원탈퇴 확인",
    message: "탈퇴하면 개인정보가 익명화되고 계정을 복구할 수 없습니다. 계속할까요?",
    title: "정말 탈퇴하시겠어요?",
  },
};

export function AccountActionConfirmationModal({
  action = "logout",
  onCancel,
  onConfirm,
  visible,
}: AccountActionConfirmationModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const copy = ACTION_COPY[action];

  useEffect(() => {
    if (!visible) {
      setSubmitting(false);
    }
  }, [visible]);

  const handleCancel = () => {
    if (!submitting) {
      onCancel();
    }
  };

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
      onRequestClose={handleCancel}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.modal}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={handleCancel}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityLabel={copy.dialogLabel}
          accessibilityViewIsModal
          style={styles.card}
        >
          <AnimatedPressable
            accessibilityLabel={copy.closeLabel}
            accessibilityRole="button"
            containerStyle={styles.closeButton}
            hitSlop={10}
            onPress={handleCancel}
          >
            <MaterialDesignIcons
              color={AUTH_COLORS.muted}
              name="close"
              size={28}
            />
          </AnimatedPressable>

          <AppText style={styles.title}>{copy.title}</AppText>
          <AppText style={styles.message}>{copy.message}</AppText>

          <View style={styles.actions}>
            <AnimatedPressable
              accessibilityLabel={copy.cancelLabel}
              accessibilityRole="button"
              containerStyle={styles.actionContainer}
              disabled={submitting}
              onPress={handleCancel}
            >
              <View style={[styles.action, styles.cancelAction]}>
                <AppText style={styles.cancelLabel}>취소</AppText>
              </View>
            </AnimatedPressable>

            <AnimatedPressable
              accessibilityLabel={copy.confirmButtonLabel}
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
                  <AppText style={styles.confirmLabel}>{copy.confirmText}</AppText>
                )}
              </View>
            </AnimatedPressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// 기존 import 호환성을 유지하면서 계정 작업 전반에서 재사용한다.
export const LogoutConfirmationModal = AccountActionConfirmationModal;

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
