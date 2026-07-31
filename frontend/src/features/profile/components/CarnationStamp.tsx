import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {StyleSheet, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';

interface CarnationStampProps {
  filled: boolean;
  size?: number;
  // 인접 달 스필오버 셀을 흐리게 표시한다(찍혀 있어도 덜 보이게).
  dimmed?: boolean;
}

// 효자 도장(카네이션) 한 칸. 채워지면 카네이션, 비면 회색 원.
// NOTE: 첨부된 카네이션 PNG를 파일로 확보하지 못해(투명 배경 검증 불가) 아이콘 플레이스홀더로 대체한다.
export function CarnationStamp({
  filled,
  size = 44,
  dimmed = false,
}: CarnationStampProps) {
  const dimension = {borderRadius: size / 2, height: size, width: size};
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        dimension,
        filled ? styles.filled : styles.empty,
        dimmed && styles.dimmed,
      ]}
    >
      {filled ? (
        <MaterialDesignIcons
          color={COLORS.error}
          name="flower"
          size={Math.round(size * 0.62)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: RADII.pill,
    justifyContent: 'center',
  },
  dimmed: {
    opacity: 0.28,
  },
  empty: {
    backgroundColor: COLORS.surfaceMuted,
  },
  filled: {
    backgroundColor: COLORS.lemon,
  },
});
