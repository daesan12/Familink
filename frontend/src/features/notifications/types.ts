export type NotificationType =
  | 'NEW_POST'
  | 'POST_ACTIVITY'
  | 'EVENT_CHANGED'
  | 'EVENT_REMINDER'
  | 'CALL_REPORT'
  | 'DAILY_REPORT'
  | 'GROUP_JOIN_REQUEST';

export interface AppNotification {
  avatarText: string;
  body: string;
  createdAtLabel: string;
  groupId?: string;
  id: string;
  isRead: boolean;
  postId?: string;
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
