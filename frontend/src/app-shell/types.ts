import type { ReactNode } from 'react';

export type GroupRole = 'guardian' | 'careReceiver';

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
  name: string;
  role: GroupRole;
}

export interface AppScreenProps {
  createCalendarEventRequestId?: number;
  createPostRequestId?: number;
  currentGroup: FamilyGroup;
  currentUserId?: number;
  currentUserName?: string;
  onCloseArchive?: () => void;
  onCloseNotifications?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
  onNotificationRead?: (notificationId: string) => void;
  onOpenNotifications?: () => void;
  onOpenPost?: (postId: string, groupId?: string) => void;
  openPostId?: string | null;
  openPostRequestId?: number;
  readNotificationIds?: readonly string[];
  role: GroupRole;
}

export type AppScreenRenderer = (props: AppScreenProps) => ReactNode;

export type AppScreenRegistry = Partial<Record<AppRoute, AppScreenRenderer>>;

export interface CurrentGroupStore {
  load(): Promise<string | null>;
  save(groupId: string): Promise<void>;
}
