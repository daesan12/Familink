import {
  useState} from 'react';
import {ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {NoticeBanner} from '../../../shared/components/NoticeBanner';
import {getGroupManagementErrorMessage} from '../api/groupManagementApi';

interface DeleteGroupModalProps {
  visible: boolean;
  onClose: () => void;
  // API 계약의 confirmationName으로 보낼 현재 그룹 이름.
  confirmationName?: string;
  // 그룹 삭제 확정 콜백. API 성공 후에만 팝업이 닫힌다.
  onDeleteGroup?: (confirmationName: string) => unknown;
}

// H-9 그룹 삭제. 그룹정보 화면 위에 뜨는 확인 팝업.
export function DeleteGroupModal({
  visible,
  onClose,
  confirmationName = '',
  onDeleteGroup,
}: DeleteGroupModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = () => {
    if (isSubmitting) {
      return;
    }

    setErrorMessage(null);
    try {
      const result = onDeleteGroup?.(confirmationName);
      if (result !== undefined && isPromiseLike(result)) {
        setIsSubmitting(true);
        result
          .then(onClose)
          .catch((error: unknown) => {
            setErrorMessage(
              getGroupManagementErrorMessage(
                error,
                '그룹을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
              ),
            );
          })
          .finally(() => setIsSubmitting(false));
        return;
      }
      onClose();
    } catch (error) {
      setErrorMessage(
        getGroupManagementErrorMessage(
          error,
          '그룹을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
    }
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
          <AppText style={styles.title}>정말 그룹을 삭제하시겠어요?</AppText>
          {errorMessage ? <NoticeBanner message={errorMessage} /> : null}
          <Pressable
            accessibilityLabel="그룹 삭제 확정"
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleDelete}
            style={styles.deleteButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <AppText style={styles.deleteButtonText}>그룹 삭제</AppText>
            )}
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

function isPromiseLike(value: unknown): value is Promise<void> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}
