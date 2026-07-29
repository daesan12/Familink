import {useState} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {AppShell} from './src/app-shell';
import type {
  AppRoute,
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
} from './src/app-shell';
import {SignupFlowScreen} from './src/features/auth/screens/SignupFlowScreen';
import {WelcomeScreen} from './src/features/auth/screens/WelcomeScreen';

type RootRoute = 'welcome' | 'signup' | 'appShell';

interface AppProps {
  groupStore?: CurrentGroupStore;
  groups?: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialRootRoute?: RootRoute;
  initialShellRoute?: AppRoute;
  onCreateGroup?: () => void;
  onGroupChange?: (groupId: string) => void;
  onJoinGroup?: () => void;
  screens?: AppScreenRegistry;
}

export default function App({
  groupStore,
  groups = [],
  initialGroupId,
  initialRootRoute = 'welcome',
  initialShellRoute,
  onCreateGroup,
  onGroupChange,
  onJoinGroup,
  screens,
}: AppProps) {
  const [route, setRoute] = useState<RootRoute>(initialRootRoute);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {route === 'welcome' ? (
        <WelcomeScreen onStartSignup={() => setRoute('signup')} />
      ) : route === 'signup' ? (
        <SignupFlowScreen
          onCancel={() => setRoute('welcome')}
          onComplete={() => setRoute('appShell')}
        />
      ) : (
        <AppShell
          groupStore={groupStore}
          groups={groups}
          initialGroupId={initialGroupId}
          initialRoute={initialShellRoute}
          onCreateGroup={onCreateGroup}
          onGroupChange={onGroupChange}
          onJoinGroup={onJoinGroup}
          screens={screens}
        />
      )}
    </SafeAreaProvider>
  );
}
