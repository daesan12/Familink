import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AppRoute, GroupRole } from './types';
import { getTabsForRole } from './navigation';

interface BottomTabBarProps {
  activeRoute: AppRoute;
  onSelect: (route: AppRoute) => void;
  role: GroupRole;
}

const COLORS = {
  active: '#6F6B68',
  border: '#E4E7EC',
  inactive: '#D6D6D6',
  surface: '#FFFFFF',
} as const;

export function BottomTabBar({
  activeRoute,
  onSelect,
  role,
}: BottomTabBarProps) {
  const tabs = getTabsForRole(role);

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {tabs.map(tab => {
        const isActive = tab.route === activeRoute;
        const color = isActive ? COLORS.active : COLORS.inactive;

        return (
          <Pressable
            accessibilityLabel={`${tab.label} 탭`}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            key={tab.route}
            onPress={() => onSelect(tab.route)}
            style={styles.tab}
          >
            <Text accessibilityElementsHidden style={[styles.icon, { color }]}>
              {tab.icon}
            </Text>
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 88,
    paddingBottom: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  icon: {
    fontSize: 30,
    lineHeight: 34,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 64,
    minWidth: 44,
  },
});
