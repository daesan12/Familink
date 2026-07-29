import type { ReactNode } from 'react';

export type GroupRole = 'guardian' | 'careReceiver';

export type AppRoute =
  | 'feed'
  | 'calendar'
  | 'report'
  | 'aiCall'
  | 'groupInfo'
  | 'profile';

export interface FamilyGroup {
  id: string;
  name: string;
  role: GroupRole;
}

export interface AppScreenProps {
  createPostRequestId?: number;
  currentGroup: FamilyGroup;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onHeaderVisibilityChange?: (isVisible: boolean) => void;
  role: GroupRole;
}

export type AppScreenRenderer = (props: AppScreenProps) => ReactNode;

export type AppScreenRegistry = Partial<Record<AppRoute, AppScreenRenderer>>;

export interface CurrentGroupStore {
  load(): Promise<string | null>;
  save(groupId: string): Promise<void>;
}
