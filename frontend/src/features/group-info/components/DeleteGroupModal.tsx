import {Modal, Pressable, StyleSheet, Text} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';

interface DeleteGroupModalProps {
  visible: boolean;
  onClose: () => void;
  // 그룹 삭제 확정 콜백(연동·B-3 전환은 후속).
  onDeleteGroup?: () => void;
}

// H-9 그룹 삭제. 그룹정보 화면 위에 뜨는 확인 팝업.
export function DeleteGroupModal({
  visible,
  onClose,
  onDeleteGroup,
}: DeleteGroupModalProps) {
  const handleDelete = () => {
    onDeleteGroup?.();
    onClose();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <Pressable
        accessibilityLabel="그룹 삭제 닫기"
        accessibilityRole="button"
        onPress={onClose}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityViewIsModal
          accessible={false}
          onPress={() => {}}
          style={styles.card}
        >
          <Text style={styles.title}>정말 그룹을 삭제하시겠어요?</Text>
          <Pressable
            accessibilityLabel="그룹 삭제 확정"
            accessibilityRole="button"
            onPress={handleDelete}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>그룹 삭제</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: COLORS.textMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    justifyContent: 'center',
    minHeight: 56,
  },
  deleteButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
});
