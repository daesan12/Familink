import type { ReactNode } from 'react';
import type { NavigatorScreenParams } from '@react-navigation/native';

import type { CalendarStackParamList } from '../features/calendar/navigationTypes';
import type { FeedStackParamList } from '../features/feed/navigationTypes';
import type { GroupInfoStackParamList } from '../features/group-info/navigationTypes';
import type { NotificationDeepLinkTarget } from '../features/notifications/deepLink';
import type { ProfileStackParamList } from '../features/profile/navigationTypes';

export type GroupRole = 'guardian' | 'careReceiver';

// 리포트 화면 딥링크 파라미터. callSessionId가 있으면 해당 통화 상세까지 연다.
export interface ReportDeepLinkParams {
  callSessionId?: string;
  memberId: string;
  reportDate: string;
}

export type AiCallResultStatus = 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type AppRoute =
  | 'feed'
  | 'calendar'
  | 'report'
  | 'aiCall'
  | 'groupInfo'
  | 'profile'
  | 'notifications'
  | 'archive'
  | 'joinApproval';

export interface FamilyGroup {
  id: string;
  // 그룹 목록 API가 제공하는 현재 사용자의 관리자 여부.
  // 개발용 fixture처럼 값이 없으면 그룹 상세·구성원 정보로 판정한다.
  isManager?: boolean;
  myMemberId?: string;
  name: string;
  role: GroupRole;
}

export interface AppAuthSession {
  getAccessToken(): string | null;
  getRefreshToken(): string | null;
  refreshAccessToken(): Promise<string>;
}

export interface AppScreenProps {
  apiBaseUrl?: string;
  authSession?: AppAuthSession;
  accessToken?: string | null;
  onCallResult?: (status: AiCallResultStatus) => void;
  currentGroup: FamilyGroup;
  currentUserId?: number;
  currentUserName?: string;
  onCloseArchive?: () => void;
  onCloseJoinApproval?: () => void;
  onCloseNotifications?: () => void;
  onCloseProfile?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
  onNotificationRead?: (notificationId: string) => void;
  onUnreadCountChange?: (count: number) => void;
  onOpenNotifications?: () => void;
  onOpenNotificationTarget?: (target: NotificationDeepLinkTarget) => void;
  onOpenPost?: (
    postId: string,
    groupId?: string,
    entrySource?: 'feed' | 'notification',
  ) => void;
  onRequestLogout?: () => void;
  // 셸이 들고 있는 읽지 않은 알림 수. 헤더에 알림 벨을 그리는 화면이 배지에 쓴다.
  unreadNotificationCount?: number;
  onRequestWithdrawal?: () => Promise<void>;
  readNotificationIds?: readonly string[];
  // 내부 스택을 가진 탭이 공유 하위 화면 라우트를 등록할 때 본문을 받는다.
  // 없으면(스택 없는 탭·단독 렌더 테스트) 해당 라우트는 빈 화면이 된다.
  renderSharedSubRoute?: SharedSubRouteRenderer;
  role: GroupRole;
}

// 셸 내부 내비게이션 화면 이름 집합 (S15P11B104-320).
// 어느 탭도 소유하지 않고 현재 화면 위에 쌓이는 공유 하위 화면.
export type SharedSubRoute = 'archive' | 'joinApproval' | 'notifications';
export type MainTabRoute = Exclude<AppRoute, SharedSubRoute>;

// 공유 하위 화면 주입 계약 (S15P11B104-367).
// 두 화면은 셸이 소유하지만(레지스트리·screenProps·포커스 신호) 렌더 위치는 탭
// 스택이다. 스택 소유자가 라우트를 등록하고 본문만 이 렌더러로 받으므로,
// 배선이 셸에 남고 피처끼리 직접 import하지 않는다.
export interface SharedSubRouteOptions {
  // 하위 화면을 스택에서 걷어낸다. 등록 지점에서 navigation.goBack()으로
  // 바인딩한다 — 화면 파일 자체는 내비게이션 훅을 갖지 않는다(단독 렌더 테스트 유지).
  onClose: () => void;
  // 하위 화면이 실제로 닫힌 뒤(언마운트) 호출된다. 등록한 탭이 자기 목록을
  // 다시 조회할 기회다.
  onClosed?: () => void;
}

export type SharedSubRouteRenderer = (
  route: SharedSubRoute,
  options: SharedSubRouteOptions,
) => ReactNode;

// feed·calendar·groupInfo·profile 탭은 내부 스택을 가진다. 딥링크·재탭 정규화가
// 중첩 params로 스택 화면까지 도달할 수 있도록 params 타입을 연결한다.
// report는 스택 없이 탭 route params로 화면 내부 동작을 전달한다 — 통화
// 상세와 리포트 캘린더가 화면 내부 상태라 스택 승격 없이 params 소비로 충분하다.
export type MainTabsParamList = Omit<
  Record<MainTabRoute, undefined>,
  'feed' | 'calendar' | 'groupInfo' | 'profile' | 'report'
> & {
  calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  feed: NavigatorScreenParams<FeedStackParamList> | undefined;
  groupInfo: NavigatorScreenParams<GroupInfoStackParamList> | undefined;
  profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
  report:
    | { openCalendar?: boolean; openReport?: ReportDeepLinkParams }
    | undefined;
};

export type AppScreenRenderer = (props: AppScreenProps) => ReactNode;

export type AppScreenRegistry = Partial<Record<AppRoute, AppScreenRenderer>>;

export interface CurrentGroupStore {
  load(): Promise<string | null>;
  save(groupId: string): Promise<void>;
}
