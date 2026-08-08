import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';

export interface GroupMenuItem {
  description: string;
  key: string;
  label: string;
  // 그룹 관리자만 실행할 수 있는 항목. 비관리자 화면에서는 아예 그리지 않는다.
  managerOnly?: boolean;
  onPress: () => void;
}

interface GroupMenuSectionProps {
  items: readonly GroupMenuItem[];
  title: string;
}

// 초대·관리 메뉴를 담는 카드 섹션. 각 행은 다음 화면으로 가는 진입점이다.
// 173에서는 구성원 섹션만 동작하고, 이 메뉴 행들은 후속 티켓(172·174 등)에서
// 실제 화면과 연결한다.
export function GroupMenuSection({items, title}: GroupMenuSectionProps) {
  return (
    <View style={styles.card}>
      <AppText style={styles.title}>{title}</AppText>
      {items.map((item, index) => (
        <Pressable
          accessibilityHint="후속 작업에서 연결될 화면입니다"
          accessibilityLabel={item.label}
          accessibilityRole="button"
          key={item.key}
          onPress={item.onPress}
          style={[styles.row, index === 0 && styles.firstRow]}
        >
          <View style={styles.rowText}>
            <AppText style={styles.rowLabel}>{item.label}</AppText>
            <AppText style={styles.rowDescription}>{item.description}</AppText>
          </View>
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
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  firstRow: {
    borderTopWidth: 0,
  },
  row: {
    alignItems: 'center',
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingVertical: 12,
  },
  rowDescription: {
    color: COLORS.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  rowLabel: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '600',
  },
  rowText: {
    flex: 1,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
    paddingBottom: 4,
    paddingTop: 14,
  },
});
