import {Image, StyleSheet, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';

const CARNATION_IMAGE = require('../../../assets/images/carnation.png');

interface CarnationStampProps {
  filled: boolean;
  size?: number;
  // 인접 달 스필오버 셀을 흐리게 표시한다(찍혀 있어도 덜 보이게).
  dimmed?: boolean;
}

// 효자 도장(카네이션) 한 칸. 채워지면 카네이션 도장 이미지, 비면 회색 원.
export function CarnationStamp({
  filled,
  size = 44,
  dimmed = false,
}: CarnationStampProps) {
  const dimension = {borderRadius: size / 2, height: size, width: size};
  const stampSize = Math.round(size * 0.8);
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
        <Image
          resizeMode="contain"
          source={CARNATION_IMAGE}
          style={{height: stampSize, width: stampSize}}
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
