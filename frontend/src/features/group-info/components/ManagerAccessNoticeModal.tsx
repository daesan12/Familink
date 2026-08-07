import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Modal, Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';

interface ManagerAccessNoticeModalProps {
  onClose: () => void;
  visible: boolean;
}

// 관리자 전용 메뉴를 누른 일반 구성원에게 현재 화면 위에서 권한을 안내한다.
export function ManagerAccessNoticeModal({
  onClose,
  visible,
}: ManagerAccessNoticeModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityLabel="그룹관리자 접근 안내"
          accessibilityRole="alert"
          accessibilityViewIsModal
          style={styles.card}>
          <View style={styles.iconWrap}>
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="shield-lock-outline"
              size={30}
            />
          </View>

          <AppText style={styles.title}>그룹 관리 권한이 필요해요</AppText>
          <AppText style={styles.message}>
            그룹관리자만 접근할 수 있습니다
          </AppText>

          <Pressable
            accessibilityLabel="그룹관리자 접근 안내 확인"
            accessibilityRole="button"
            onPress={onClose}
            style={({pressed}) => [
              styles.confirmButton,
              pressed && styles.confirmButtonPressed,
            ]}>
            <AppText style={styles.confirmButtonText}>확인</AppText>
          </Pressable>
        </View>
      </View>
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
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderRadius: RADII.sheet,
    maxWidth: 360,
    paddingBottom: 28,
    paddingHorizontal: 24,
    paddingTop: 30,
    width: '100%',
  },
  confirmButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: COLORS.lavender,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 56,
  },
  confirmButtonPressed: {
    opacity: 0.82,
  },
  confirmButtonText: {
    color: COLORS.purpleDeep,
    fontSize: 16,
    fontWeight: '700',
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  message: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
    textAlign: 'center',
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 28,
    marginTop: 18,
    textAlign: 'center',
  },
});
