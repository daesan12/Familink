import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {COLORS, RADII} from '../../design/tokens';

interface BackButtonProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  onPress?: () => void;
  // 헤더마다 다른 배치(absolute 등)를 위해 위치 관련 스타일만 받는다.
  // 크기·색은 이 컴포넌트가 소유하므로 덮어쓰지 않는다.
  style?: StyleProp<ViewStyle>;
}

// 화면 공용 뒤로가기 버튼. 연보라 원 배경 + 보라 화살표로 앱 전체에서 통일한다.
export function BackButton({
  accessibilityLabel = '뒤로 가기',
  disabled = false,
  onPress,
  style,
}: BackButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        pressed && styles.pressed,
        style,
      ]}
    >
      <MaterialDesignIcons
        color={COLORS.purpleDeep}
        name="chevron-left"
        size={28}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.72,
  },
});
