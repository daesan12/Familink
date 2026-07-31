import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';

interface SubScreenHeaderProps {
  title: string;
  onBack: () => void;
}

// 그룹정보 하위 전체화면(H-4·H-5) 공통 헤더. 왼쪽 뒤로가기 + 가운데 제목.
export function SubScreenHeader({title, onBack}: SubScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="뒤로 가기"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onBack}
        style={styles.backButton}
      >
        <MaterialDesignIcons
          color={COLORS.textStrong}
          name="chevron-left"
          size={24}
        />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    left: 20,
    position: 'absolute',
    width: 36,
    zIndex: 1,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
});
