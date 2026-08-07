import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet} from 'react-native';
import {AppText} from './AppText';

import {COLORS, RADII} from '../../design/tokens';

interface RetryButtonProps {
  // 화면 문맥을 담은 접근성 라벨(예: "프로필 다시 시도"). 없으면 label을 쓴다.
  accessibilityLabel?: string;
  label?: string;
  onPress?: () => void;
}

// 요청 실패 화면 공용 재시도 버튼. 알약형 + 새로고침 아이콘,
// 노란 배경 + 보라 텍스트로 앱 전체에서 같은 모양을 쓴다.
export function RetryButton({
  accessibilityLabel,
  label = '다시 시도',
  onPress,
}: RetryButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.button, pressed && styles.pressed]}
    >
      <MaterialDesignIcons
        color={COLORS.purpleDeep}
        name="refresh"
        size={18}
      />
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.lemon,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 22,
  },
  label: {
    color: COLORS.purpleDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.82,
  },
});
