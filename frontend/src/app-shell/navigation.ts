import type {
  AppRoute,
  FamilyGroup,
  GroupRole,
  MainTabRoute,
  SharedSubRoute,
} from './types.ts';

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
  // 하단 탭에는 탭 라우트만 올 수 있다. notifications·archive는 탭이 아니다.
  route: MainTabRoute;
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

// 공유 하위 화면은 어느 탭도 소유하지 않으므로 역할과 무관하게 항상 허용된다.
// Record로 두면 SharedSubRoute가 늘어날 때 컴파일 에러가 난다 — 목록을 빠뜨리면
// resolveAllowedRoute가 조용히 'feed'로 폴백해 하위 화면이 열리지 않는다.
const IS_SHARED_SUB_ROUTE: Record<SharedSubRoute, true> = {
  archive: true,
  joinApproval: true,
  notifications: true,
};

export function isRouteAllowed(role: GroupRole, route: AppRoute): boolean {
  return (
    route in IS_SHARED_SUB_ROUTE ||
    getTabsForRole(role).some((tab) => tab.route === route)
  );
}

// 탭 라우트를 넣으면 탭 라우트가 나온다(폴백 'feed'도 탭 라우트다). 셸이
// 하위 화면과 탭을 분리해 다루므로 입력 타입을 그대로 좁혀 돌려준다.
export function resolveAllowedRoute<Route extends AppRoute>(
  role: GroupRole,
  requestedRoute: Route
): Route | 'feed' {
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
