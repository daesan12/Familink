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
  | 'archive';

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
  createPostRequestId?: number;
  currentGroup: FamilyGroup;
  currentUserId?: number;
  currentUserName?: string;
  onCloseArchive?: () => void;
  onCloseNotifications?: () => void;
  onCloseProfile?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
  onNotificationRead?: (notificationId: string) => void;
  onUnreadCountChange?: (count: number) => void;
  onOpenNotifications?: () => void;
  onOpenNotificationTarget?: (target: NotificationDeepLinkTarget) => void;
  onOpenPost?: (postId: string, groupId?: string) => void;
  onRequestLogout?: () => void;
  onRequestWithdrawal?: () => Promise<void>;
  openJoinApprovalRequestId?: number;
  openPostId?: string | null;
  openPostRequestId?: number;
  openReportRequestId?: number;
  openReportTarget?: ReportDeepLinkParams | null;
  readNotificationIds?: readonly string[];
  role: GroupRole;
}

// 셸 내부 내비게이션 화면 이름 집합 (S15P11B104-320).
// notifications·archive는 탭이 아니라 ShellStack에서 탭 위로 쌓이는 화면이다.
export type MainTabRoute = Exclude<AppRoute, 'notifications' | 'archive'>;

// feed·calendar·groupInfo·profile 탭은 내부 스택을 가진다. 딥링크·재탭 정규화가
// 중첩 params로 스택 화면까지 도달할 수 있도록 params 타입을 연결한다.
// report는 스택 없이 탭 route params로 딥링크를 받는다 — 통화 상세가 화면
// 내부 상태라 스택 승격 없이 params 소비로 충분하다.
export type MainTabsParamList = Omit<
  Record<MainTabRoute, undefined>,
  'feed' | 'calendar' | 'groupInfo' | 'profile' | 'report'
> & {
  calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  feed: NavigatorScreenParams<FeedStackParamList> | undefined;
  groupInfo: NavigatorScreenParams<GroupInfoStackParamList> | undefined;
  profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
  report: ReportDeepLinkParams | undefined;
};

export type ShellStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  archive: undefined;
  notifications: undefined;
};

export type AppScreenRenderer = (props: AppScreenProps) => ReactNode;

export type AppScreenRegistry = Partial<Record<AppRoute, AppScreenRenderer>>;

export interface CurrentGroupStore {
  load(): Promise<string | null>;
  save(groupId: string): Promise<void>;
}
