import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppShell} from './src/app-shell';
import type {
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
} from './src/app-shell';

interface AppProps {
  groupStore?: CurrentGroupStore;
  groups?: readonly FamilyGroup[];
  initialGroupId?: string | null;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
  screens?: AppScreenRegistry;
}

export default function App({
  groupStore,
  groups = [],
  initialGroupId,
  onCreateGroup,
  onJoinGroup,
  screens,
}: AppProps) {
  return (
    <SafeAreaProvider>
      <AppShell
        groupStore={groupStore}
        groups={groups}
        initialGroupId={initialGroupId}
        onCreateGroup={onCreateGroup}
        onJoinGroup={onJoinGroup}
        screens={screens}
      />
    </SafeAreaProvider>
  );
}
