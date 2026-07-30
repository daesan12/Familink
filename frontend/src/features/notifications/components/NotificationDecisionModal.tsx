import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';

interface NotificationDecisionModalProps {
  mode: 'approve' | 'reject' | null;
  onClose: () => void;
  onSelectRole: (role: 'guardian' | 'careReceiver') => void;
}

export function NotificationDecisionModal({
  mode,
  onClose,
  onSelectRole,
}: NotificationDecisionModalProps) {
  const isApprove = mode === 'approve';

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={mode !== null}
    >
      <Pressable
        accessibilityLabel="알림 팝업 닫기"
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="alert"
          onPress={() => undefined}
          style={styles.card}
        >
          {isApprove ? (
            <>
              <Text style={styles.message}>
                수호님이 우리 가족에 참여했습니다.{'\n'}
                가족의 역할을 정해주세요
              </Text>
              <Text style={styles.roleTitle}>[손수호]님의 역할</Text>
              <View style={styles.roleActions}>
                <RoleButton
                  label="보호자"
                  onPress={() => onSelectRole('guardian')}
                />
                <RoleButton
                  label="피보호자"
                  onPress={() => onSelectRole('careReceiver')}
                />
              </View>
            </>
          ) : (
            <Text style={styles.message}>
              수호님의 그룹 참여 신청이 거절되었습니다.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function RoleButton({label, onPress}: {label: string; onPress: () => void}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.roleButton,
        pressed && styles.roleButtonPressed,
      ]}
    >
      <Text style={styles.roleButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(80, 80, 80, 0.68)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    justifyContent: 'center',
    maxWidth: 330,
    minHeight: 112,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
  },
  message: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 24,
    textAlign: 'center',
  },
  roleActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  roleButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderRadius: RADII.pill,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 20,
  },
  roleButtonPressed: {
    opacity: 0.72,
    transform: [{scale: 0.96}],
  },
  roleButtonText: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  roleTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
});
