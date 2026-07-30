import { useState } from "react";
import { Alert, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppShell } from "./src/app-shell";
import type {
  AppRoute,
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
} from "./src/app-shell";
import { mockAuthGateway } from "./src/features/auth/api/mockAuthGateway";
import type { CreateGroupInput } from "./src/features/auth/components/CreateGroupSheet";
import { LoginBottomSheet } from "./src/features/auth/components/LoginBottomSheet";
import { GroupOnboardingScreen } from "./src/features/auth/screens/GroupOnboardingScreen";
import { SignedInWelcomeScreen } from "./src/features/auth/screens/SignedInWelcomeScreen";
import { SignupFlowScreen } from "./src/features/auth/screens/SignupFlowScreen";
import { WelcomeScreen } from "./src/features/auth/screens/WelcomeScreen";
import type {
  AuthenticatedUser,
  AuthGateway,
  LoginCredentials,
} from "./src/features/auth/types";
import { FeedScreen } from "./src/features/feed";

type RootRoute =
  | "welcome"
  | "signup"
  | "signedInWelcome"
  | "groupOnboarding"
  | "appShell";

interface AppProps {
  authGateway?: AuthGateway;
  groupStore?: CurrentGroupStore;
  groups?: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialRootRoute?: RootRoute;
  initialShellRoute?: AppRoute;
  onCreateGroup?: (input: CreateGroupInput) => FamilyGroup | void;
  onGroupChange?: (groupId: string) => void;
  onJoinGroup?: () => void;
  onOpenActiveGroup?: (activeGroupId: string) => void;
  screens?: AppScreenRegistry;
}

const DEVELOPMENT_GROUPS: readonly FamilyGroup[] = [
  {
    id: "development-care-receiver-group",
    name: "동창 모임방",
    role: "careReceiver",
  },
  {
    id: "development-empty-group",
    name: "교회 소모임",
    role: "guardian",
  },
  {
    id: "development-guardian-group",
    name: "우리 가족의 이야기",
    role: "guardian",
  },
];

const DEFAULT_SCREENS: AppScreenRegistry = {
  feed: FeedScreen,
};

export default function App({
  authGateway = mockAuthGateway,
  groupStore,
  groups,
  initialGroupId,
  initialRootRoute = "welcome",
  initialShellRoute,
  onCreateGroup,
  onGroupChange,
  onJoinGroup,
  onOpenActiveGroup,
  screens,
}: AppProps) {
  const [route, setRoute] = useState<RootRoute>(initialRootRoute);
  const [groupOnboardingReturnRoute, setGroupOnboardingReturnRoute] =
    useState<Exclude<RootRoute, "groupOnboarding">>("welcome");
  const [loginVisible, setLoginVisible] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [activeGroupId, setActiveGroupId] = useState(initialGroupId);
  const [createdGroups, setCreatedGroups] = useState<FamilyGroup[]>([]);
  const resolvedGroups = [
    ...(groups ?? (__DEV__ ? DEVELOPMENT_GROUPS : [])),
    ...createdGroups,
  ];

  const handleLogin = async (credentials: LoginCredentials) => {
    const authenticatedUser = await authGateway.login(credentials);
    setUser(authenticatedUser);
    setLoginVisible(false);

    if (authenticatedUser.activeGroupId !== null) {
      setActiveGroupId(authenticatedUser.activeGroupId);
      onOpenActiveGroup?.(authenticatedUser.activeGroupId);
      setRoute("appShell");
      return;
    }

    setRoute("signedInWelcome");
  };

  const handleLogout = async () => {
    await authGateway.logout();
    setUser(null);
    setRoute("welcome");
  };

  const showDeferredFeature = (title: string) => {
    Alert.alert(title, "후속 작업에서 연결될 화면입니다.");
  };

  const handleCreateGroup = (input: CreateGroupInput) => {
    const providedGroup = onCreateGroup?.(input);
    const createdGroup: FamilyGroup = providedGroup ?? {
      id: `created-group-${Date.now()}`,
      name: input.name,
      role: input.role,
    };

    setCreatedGroups((current) => [...current, createdGroup]);
    setActiveGroupId(createdGroup.id);
    onGroupChange?.(createdGroup.id);
    if (providedGroup !== undefined) {
      groupStore?.save(createdGroup.id).catch(() => {
        // 서버가 확정한 그룹만 저장하고 오류 처리는 상위 앱 계층에 위임한다.
      });
    }
    setRoute("appShell");
  };

  const openGroupOnboarding = (
    returnRoute: Exclude<RootRoute, "groupOnboarding">
  ) => {
    setGroupOnboardingReturnRoute(returnRoute);
    setRoute("groupOnboarding");
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      {route === "welcome" && (
        <>
          <WelcomeScreen
            onStartLogin={() => setLoginVisible(true)}
            onStartSignup={() => setRoute("signup")}
          />
          <LoginBottomSheet
            onDismiss={() => setLoginVisible(false)}
            onLogin={handleLogin}
            visible={loginVisible}
          />
        </>
      )}
      {route === "signup" && (
        <SignupFlowScreen
          onCancel={() => setRoute("welcome")}
          onComplete={() => setRoute("welcome")}
        />
      )}
      {route === "appShell" && (
        <AppShell
          groupStore={groupStore}
          groups={resolvedGroups}
          initialGroupId={activeGroupId}
          initialRoute={initialShellRoute}
          onCreateGroup={() => openGroupOnboarding("appShell")}
          onGroupChange={onGroupChange}
          onJoinGroup={onJoinGroup}
          screens={screens ?? DEFAULT_SCREENS}
        />
      )}
      {route === "signedInWelcome" && user !== null && (
        <SignedInWelcomeScreen
          onLogout={handleLogout}
          onRequestWithdrawal={() => showDeferredFeature("회원 탈퇴")}
          onStartGroupOnboarding={() =>
            openGroupOnboarding("signedInWelcome")
          }
          userName={user.name}
        />
      )}
      {route === "groupOnboarding" && (
        <GroupOnboardingScreen
          onBack={() => setRoute(groupOnboardingReturnRoute)}
          onCreateGroup={handleCreateGroup}
          onJoinByCode={() => {
            if (onJoinGroup !== undefined) {
              onJoinGroup();
              return;
            }

            showDeferredFeature("코드로 참여");
          }}
          pendingRequests={[]}
        />
      )}
    </SafeAreaProvider>
  );
}
