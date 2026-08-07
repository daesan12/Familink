import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';

export interface MyPageMenuItem {
  key: string;
  label: string;
  onPress: () => void;
}

interface MyPageSettingsSectionProps {
  items: readonly MyPageMenuItem[];
}

// I-1·J-1 '설정' 메뉴 카드. 항목 목록만 다르고 구조는 두 역할이 공유한다.
export function MyPageSettingsSection({items}: MyPageSettingsSectionProps) {
  return (
    <View style={styles.card}>
      <AppText style={styles.sectionTitle}>설정</AppText>
      {items.map((item, index) => (
        <Pressable
          accessibilityLabel={item.label}
          accessibilityRole="button"
          key={item.key}
          onPress={item.onPress}
          style={[styles.row, index < items.length - 1 && styles.divider]}
        >
          <AppText style={styles.label}>{item.label}</AppText>
          <MaterialDesignIcons
            color={COLORS.textSubtle}
            name="chevron-right"
            size={22}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    paddingHorizontal: 18,
  },
  divider: {
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  sectionTitle: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
    paddingBottom: 6,
    paddingTop: 16,
  },
});
