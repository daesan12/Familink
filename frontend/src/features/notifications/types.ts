export type NotificationType =
  | 'NEW_POST'
  | 'POST_ACTIVITY'
  | 'EVENT_CHANGED'
  | 'EVENT_REMINDER'
  | 'CALL_REPORT'
  | 'DAILY_REPORT'
  | 'GROUP_JOIN_REQUEST';

export type NotificationJoinRequestStatus =
  | 'PENDING_ADMIN'
  | 'APPROVED'
  | 'REJECTED';

export interface AppNotification {
  // 알림을 발생시킨 사용자 이름. 가입 요청 알림의 역할 지정 팝업에 표시한다.
  actorName?: string;
  // 행위자 프로필 사진(API-NOTIFICATIONS-003 actor.profileImageUrl).
  // 없으면 알림 종류 아이콘으로 대체한다(NotificationItem TYPE_ICONS).
  actorProfileImageUrl?: string;
  // 행위자 이름 이니셜. 목록은 종류 아이콘을 쓰므로 지금은 표시하지 않는다.
  avatarText: string;
  body: string;
  createdAt?: string;
  createdAtLabel: string;
  groupId?: string;
  id: string;
  isRead: boolean;
  postId?: string;
  relatedCallReportId?: string;
  // 리포트 알림 탭 이동용 조회 키. 리포트 조회 API가 callSessionId 또는
  // 날짜·멤버 조합을 요구해 relatedCallReportId·relatedDailyReportId만으로는 열 수 없다.
  relatedCallSessionId?: string;
  relatedCareReceiverMemberId?: string;
  relatedDailyReportId?: string;
  relatedEventId?: string;
  relatedJoinRequestId?: string;
  relatedJoinRequestStatus: NotificationJoinRequestStatus | null;
  // yyyy-MM-dd
  relatedReportDate?: string;
  requestKind?: 'groupJoin';
  title: string;
  type: NotificationType;
}

export interface NotificationSetting {
  // 토글 아래에 보조 설명이 필요한 항목만 채운다(I-6 목업 기준).
  description?: string;
  enabled: boolean;
  label: string;
  type: NotificationType;
}

// I-6 알림 설정 화면의 섹션 묶음. 각 섹션은 표시할 설정 유형을 순서대로 가진다.
export interface NotificationSettingGroup {
  title: string;
  types: readonly NotificationType[];
}

export interface NotificationPage {
  hasNext: boolean;
  notifications: readonly AppNotification[];
}

export interface NotificationReadResult {
  id: string;
  readAt: string;
}

export interface NotificationReadAllResult {
  readAt: string;
  updatedCount: number;
}

export interface NotificationSettingsUpdateResult {
  updatedAt: string;
}

export interface DeviceTokenRegistration {
  active: true;
  deviceType: 'ANDROID';
  id: string;
}

export type DevicePermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'unavailable';

export interface DeviceTokenProvider {
  getToken(): Promise<string | null>;
  requestPermission(): Promise<DevicePermissionStatus>;
  subscribeTokenRefresh?: (listener: (token: string) => void) => () => void;
}

export interface NotificationGateway {
  deleteAllNotifications(): Promise<void>;
  deleteNotification(notificationId: string): Promise<void>;
  deactivateDeviceToken(token: string): Promise<void>;
  getUnreadCount(): Promise<number>;
  loadPage(page: number, size?: number): Promise<NotificationPage>;
  loadSettings(): Promise<readonly NotificationSetting[]>;
  markAllRead(): Promise<NotificationReadAllResult>;
  markRead(notificationId: string): Promise<NotificationReadResult>;
  registerDeviceToken(token: string): Promise<DeviceTokenRegistration>;
  updateSettings(
    settings: readonly NotificationSetting[],
  ): Promise<NotificationSettingsUpdateResult>;
}
