import Calendar from 'lucide-react-native/icons/calendar';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import FileChartColumn from 'lucide-react-native/icons/file-chart-column';
import House from 'lucide-react-native/icons/house';
import PhoneCall from 'lucide-react-native/icons/phone-call';
import UsersRound from 'lucide-react-native/icons/users-round';
import {Pressable, StyleSheet, View} from 'react-native';
import {AppText} from '../shared/components/AppText';

import {COLORS} from '../design/tokens';
import type {AppRoute, GroupRole} from './types';
import {getTabsForRole, type TabIconName} from './navigation';

interface BottomTabBarProps {
  activeRoute: AppRoute;
  onSelect: (route: AppRoute) => void;
  role: GroupRole;
}

const TAB_ICONS = {
  calendar: Calendar,
  'circle-user-round': CircleUserRound,
  'file-chart-column': FileChartColumn,
  house: House,
  'phone-call': PhoneCall,
  'users-round': UsersRound,
} satisfies Record<TabIconName, typeof House>;

export function BottomTabBar({activeRoute, onSelect, role}: BottomTabBarProps) {
  const tabs = getTabsForRole(role);

  return (
    <View accessibilityRole="tablist" style={styles.container}>
      {tabs.map((tab) => {
        const isActive = tab.route === activeRoute;
        const color = isActive ? COLORS.purpleDeep : COLORS.inactive;
        const Icon = TAB_ICONS[tab.icon];

        return (
          <Pressable
            accessibilityLabel={`${tab.label} 탭`}
            accessibilityRole="tab"
            accessibilityState={{selected: isActive}}
            key={tab.route}
            onPress={() => onSelect(tab.route)}
            style={styles.tab}
          >
            <Icon color={color} size={24} strokeWidth={2} />
            <AppText style={[styles.label, {color}]}>{tab.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 92,
    paddingBottom: 12,
    paddingHorizontal: 4,
    paddingTop: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginTop: 4,
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 68,
    minWidth: 44,
  },
});
