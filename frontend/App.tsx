import {useState} from 'react';
import {Alert, StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {mockAuthGateway} from './src/features/auth/api/mockAuthGateway';
import {LoginBottomSheet} from './src/features/auth/components/LoginBottomSheet';
import {GroupOnboardingScreen} from './src/features/auth/screens/GroupOnboardingScreen';
import {SignedInWelcomeScreen} from './src/features/auth/screens/SignedInWelcomeScreen';
import {SignupFlowScreen} from './src/features/auth/screens/SignupFlowScreen';
import {WelcomeScreen} from './src/features/auth/screens/WelcomeScreen';
import type {
  AuthenticatedUser,
  AuthGateway,
  LoginCredentials,
} from './src/features/auth/types';

type AppRoute = 'welcome' | 'signup' | 'signedInWelcome' | 'groupOnboarding';

interface AppProps {
  authGateway?: AuthGateway;
  onOpenActiveGroup?: (activeGroupId: string) => void;
}

export default function App({
  authGateway = mockAuthGateway,
  onOpenActiveGroup,
}: AppProps) {
  const [route, setRoute] = useState<AppRoute>('welcome');
  const [loginVisible, setLoginVisible] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const handleLogin = async (credentials: LoginCredentials) => {
    const authenticatedUser = await authGateway.login(credentials);
    setUser(authenticatedUser);
    setLoginVisible(false);

    if (authenticatedUser.activeGroupId !== null) {
      if (onOpenActiveGroup !== undefined) {
        onOpenActiveGroup(authenticatedUser.activeGroupId);
        return;
      }

      setUser(null);
      setRoute('welcome');
      Alert.alert(
        '그룹 화면 준비 중',
        '활성 그룹 진입은 후속 인증·내비게이션 작업에서 연결됩니다.',
      );
      return;
    }

    setRoute('signedInWelcome');
  };

  const handleLogout = async () => {
    await authGateway.logout();
    setUser(null);
    setRoute('welcome');
  };

  const showDeferredFeature = (title: string) => {
    Alert.alert(title, '후속 작업에서 연결될 화면입니다.');
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {route === 'welcome' && (
        <>
          <WelcomeScreen
            onStartLogin={() => setLoginVisible(true)}
            onStartSignup={() => setRoute('signup')}
          />
          <LoginBottomSheet
            onDismiss={() => setLoginVisible(false)}
            onLogin={handleLogin}
            visible={loginVisible}
          />
        </>
      )}
      {route === 'signup' && (
        <SignupFlowScreen
          onCancel={() => setRoute('welcome')}
          onComplete={() => setRoute('welcome')}
        />
      )}
      {route === 'signedInWelcome' && user !== null && (
        <SignedInWelcomeScreen
          onLogout={handleLogout}
          onRequestWithdrawal={() => showDeferredFeature('회원 탈퇴')}
          onStartGroupOnboarding={() => setRoute('groupOnboarding')}
          userName={user.name}
        />
      )}
      {route === 'groupOnboarding' && (
        <GroupOnboardingScreen
          onBack={() => setRoute('signedInWelcome')}
          onCreateGroup={() => showDeferredFeature('새 그룹 만들기')}
          onJoinByCode={() => showDeferredFeature('코드로 참여')}
          pendingRequests={[]}
        />
      )}
    </SafeAreaProvider>
  );
}
