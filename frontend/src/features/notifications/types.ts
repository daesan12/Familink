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
  enabled: boolean;
  label: string;
  type: NotificationType;
}

export type DevicePermissionStatus = 'allowed' | 'denied';
export type DeviceTokenStatus = 'active' | 'inactive';
