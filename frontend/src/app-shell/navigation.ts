import type {AppRoute, FamilyGroup, GroupRole} from './types.ts';

export type TabIconName =
  | 'calendar'
  | 'circle-user-round'
  | 'file-chart-column'
  | 'house'
  | 'phone-call'
  | 'users-round';

export interface TabDefinition {
  icon: TabIconName;
  label: string;
  route: AppRoute;
}

const COMMON_START_TABS: readonly TabDefinition[] = [
  {icon: 'house', label: '피드', route: 'feed'},
  {icon: 'calendar', label: '일정', route: 'calendar'},
];

const COMMON_END_TABS: readonly TabDefinition[] = [
  {icon: 'users-round', label: '그룹정보', route: 'groupInfo'},
  {icon: 'circle-user-round', label: '프로필', route: 'profile'},
];

const ROLE_TAB: Record<GroupRole, TabDefinition> = {
  guardian: {
    icon: 'file-chart-column',
    label: '리포트',
    route: 'report',
  },
  careReceiver: {
    icon: 'phone-call',
    label: 'AI 전화',
    route: 'aiCall',
  },
};

export function getTabsForRole(role: GroupRole): readonly TabDefinition[] {
  return [...COMMON_START_TABS, ROLE_TAB[role], ...COMMON_END_TABS];
}

export function isRouteAllowed(role: GroupRole, route: AppRoute): boolean {
  return getTabsForRole(role).some((tab) => tab.route === route);
}

export function resolveAllowedRoute(
  role: GroupRole,
  requestedRoute: AppRoute
): AppRoute {
  return isRouteAllowed(role, requestedRoute) ? requestedRoute : 'feed';
}

export function resolveCurrentGroup(
  groups: readonly FamilyGroup[],
  preferredGroupId: string | null | undefined
): FamilyGroup | null {
  if (groups.length === 0) {
    return null;
  }

  return (
    groups.find((group) => group.id === preferredGroupId) ??
    groups[groups.length - 1] ??
    null
  );
}
