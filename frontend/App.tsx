import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppShell } from "./src/app-shell";
import type {
  AppRoute,
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
} from "./src/app-shell";
import { apiAuthGateway } from "./src/features/auth/api/authGateway";
import { LoginBottomSheet } from "./src/features/auth/components/LoginBottomSheet";
import type { CreateGroupInput } from "./src/features/auth/components/CreateGroupSheet";
import {
  type ApprovedJoinRequest,
  GroupOnboardingScreen,
  type PendingJoinRequest,
} from "./src/features/auth/screens/GroupOnboardingScreen";
import { InterestSelectionScreen } from "./src/features/auth/screens/InterestSelectionScreen";
import { SignedInWelcomeScreen } from "./src/features/auth/screens/SignedInWelcomeScreen";
import { SignupFlowScreen } from "./src/features/auth/screens/SignupFlowScreen";
import { WelcomeScreen } from "./src/features/auth/screens/WelcomeScreen";
import type {
  AuthenticatedUser,
  AuthGateway,
  LoginCredentials,
} from "./src/features/auth/types";
import {
  authSessionManager,
  type AuthSessionCoordinator,
} from "./src/features/auth/session";
import { AiCallScreen } from "./src/features/ai-call";
import { ArchiveScreen } from "./src/features/archive";
import {
  CalendarGatewayProvider,
  CalendarScreen,
  createCalendarHttpGateway,
  type CalendarGateway,
} from "./src/features/calendar";
import { FeedScreen } from "./src/features/feed";
import { GroupInfoScreen } from "./src/features/group-info";
import { NotificationsScreen } from "./src/features/notifications";

type RootRoute =
  | "welcome"
  | "signup"
  | "signedInWelcome"
  | "groupOnboarding"
  | "interestSetup"
  | "appShell";

interface AppProps {
  apiBaseUrl?: string;
  authGateway?: AuthGateway;
  calendarGateway?: CalendarGateway;
  authSession?: AuthSessionCoordinator;
  groupStore?: CurrentGroupStore;
  groups?: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialJoinRequests?: readonly PendingJoinRequest[];
  initialRootRoute?: RootRoute;
  initialShellRoute?: AppRoute;
  onCreateGroup?: (input: CreateGroupInput) => FamilyGroup | void;
  onGroupChange?: (groupId: string) => void;
  onJoinGroup?: (
    inviteCode: string
  ) => PendingJoinRequest | Promise<PendingJoinRequest>;
  onOpenActiveGroup?: (activeGroupId: string) => void;
  onSaveInterests?: (input: {
    groupId: string;
    interests: readonly string[];
  }) => Promise<void> | void;
  screens?: AppScreenRegistry;
}

const DEVELOPMENT_GROUPS: readonly FamilyGroup[] = [
  {
    id: "development-care-receiver-group",
    name: "할머니랑 사촌들",
    role: "careReceiver",
  },
  {
    id: "development-empty-group",
    name: "외갓집 식구들",
    role: "guardian",
  },
  {
    id: "development-guardian-group",
    name: "우리 가족의 이야기",
    role: "guardian",
  },
];

const DEFAULT_SCREENS: AppScreenRegistry = {
  aiCall: AiCallScreen,
  archive: ArchiveScreen,
  calendar: CalendarScreen,
  feed: FeedScreen,
  groupInfo: GroupInfoScreen,
  notifications: NotificationsScreen,
};

const DEFAULT_API_BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080";

export default function App({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  authGateway = apiAuthGateway,
  calendarGateway,
  authSession = authSessionManager,
  groupStore,
  groups,
  initialGroupId,
  initialJoinRequests = [],
  initialRootRoute = "welcome",
  initialShellRoute,
  onCreateGroup,
  onGroupChange,
  onJoinGroup,
  onOpenActiveGroup,
  onSaveInterests,
  screens,
}: AppProps) {
  const shouldRestoreSession = initialRootRoute === "welcome";
  const [route, setRoute] = useState<RootRoute>(initialRootRoute);
  const [groupOnboardingReturnRoute, setGroupOnboardingReturnRoute] =
    useState<Exclude<RootRoute, "groupOnboarding">>("welcome");
  const [loginVisible, setLoginVisible] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [activeGroupId, setActiveGroupId] = useState(initialGroupId);
  const [createdGroups, setCreatedGroups] = useState<FamilyGroup[]>([]);
  const [interestGroup, setInterestGroup] = useState<FamilyGroup | null>(null);
  const [joinRequests, setJoinRequests] =
    useState<readonly PendingJoinRequest[]>(initialJoinRequests);
  const resolvedCalendarGateway = useMemo(
    () =>
      calendarGateway ??
      createCalendarHttpGateway({
        baseUrl: apiBaseUrl,
        getAccessToken: () => authGateway.getAccessToken?.() ?? null,
      }),
    [apiBaseUrl, authGateway, calendarGateway]
  );
  const [authenticationResolved, setAuthenticationResolved] = useState(
    !shouldRestoreSession
  );
  const resolvedGroups = [
    ...(groups ?? (__DEV__ ? DEVELOPMENT_GROUPS : [])),
    ...createdGroups,
  ];

  const clearAuthenticationState = useCallback(() => {
    setUser(null);
    setActiveGroupId(null);
    setCreatedGroups([]);
    setInterestGroup(null);
    setJoinRequests([]);
    setGroupOnboardingReturnRoute("welcome");
    setLoginVisible(false);
    setRoute("welcome");
  }, []);

  const enterAuthenticatedState = useCallback(
    (authenticatedUser: AuthenticatedUser) => {
      setUser(authenticatedUser);

      if (authenticatedUser.activeGroupId !== null) {
        setActiveGroupId(authenticatedUser.activeGroupId);
        onOpenActiveGroup?.(authenticatedUser.activeGroupId);
        setRoute("appShell");
        return;
      }

      setRoute("signedInWelcome");
    },
    [onOpenActiveGroup]
  );

  useEffect(() => {
    let disposed = false;
    let invalidated = false;
    const unsubscribe = authSession.subscribeAuthInvalidated(() => {
      invalidated = true;
      if (!disposed) {
        clearAuthenticationState();
        setAuthenticationResolved(true);
      }
    });

    if (!shouldRestoreSession) {
      return unsubscribe;
    }

    setAuthenticationResolved(false);
    authSession
      .restore()
      .then((result) => {
        if (disposed || invalidated) {
          return;
        }
        if (result.status === "authenticated") {
          const restoredUser: AuthenticatedUser = {
            activeGroupId: initialGroupId ?? null,
            id: result.user.id,
            name: result.user.name,
          };
          enterAuthenticatedState(restoredUser);
          setAuthenticationResolved(true);
          return;
        }
        if (result.status === "signedOut") {
          clearAuthenticationState();
          setAuthenticationResolved(true);
        }
      })
      .catch(() => {
        // 확정되지 않은 복원 오류에서는 인증·비로그인 화면을 선택하지 않는다.
      });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [
    authSession,
    clearAuthenticationState,
    enterAuthenticatedState,
    initialGroupId,
    shouldRestoreSession,
  ]);

  const handleLogin = async (credentials: LoginCredentials) => {
    const authenticatedUser = await authGateway.login(credentials);
    setLoginVisible(false);
    enterAuthenticatedState(authenticatedUser);
  };

  const handleLogout = async () => {
    let failure: unknown;
    try {
      await authGateway.logout();
    } catch (error) {
      failure = error;
    }

    try {
      await authSession.clearLocalSession();
    } catch (error) {
      failure ??= error;
    } finally {
      clearAuthenticationState();
      setAuthenticationResolved(true);
    }

    if (failure !== undefined) {
      throw failure;
    }
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
    if (createdGroup.role === "careReceiver") {
      setInterestGroup(createdGroup);
      setRoute("interestSetup");
      return;
    }
    setRoute("appShell");
  };

  const handleJoinGroup = async (inviteCode: string) => {
    if (onJoinGroup === undefined) {
      showDeferredFeature("코드로 참여");
      return;
    }

    const request = await onJoinGroup(inviteCode);
    setJoinRequests((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== request.id);
      return [...withoutDuplicate, request];
    });
  };

  const handleOpenApprovedGroup = (request: ApprovedJoinRequest) => {
    const groupId = request.groupId;
    setCreatedGroups((current) => {
      if (current.some((group) => group.id === groupId)) {
        return current;
      }

      return [
        ...current,
        {
          id: groupId,
          name: request.groupName,
          role: request.role,
        },
      ];
    });
    setActiveGroupId(groupId);
    onGroupChange?.(groupId);
    groupStore?.save(groupId).catch(() => {
      // 그룹 진입은 유지하고 영속화 오류 처리는 상위 앱 계층에 위임한다.
    });
    if (request.role === "careReceiver") {
      setInterestGroup({
        id: groupId,
        name: request.groupName,
        role: request.role,
      });
      setRoute("interestSetup");
      return;
    }
    setRoute("appShell");
  };

  const handleFinishInterestSetup = () => {
    setInterestGroup(null);
    setRoute("appShell");
  };

  const openGroupOnboarding = (
    returnRoute: Exclude<RootRoute, "groupOnboarding">
  ) => {
    setGroupOnboardingReturnRoute(returnRoute);
    setRoute("groupOnboarding");
  };

  if (!authenticationResolved) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <CalendarGatewayProvider gateway={resolvedCalendarGateway}>
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
            onCreateCalendarEvent={() => showDeferredFeature("일정 추가")}
            onCreateGroup={() => openGroupOnboarding("appShell")}
            onEditCalendarEvent={() => showDeferredFeature("일정 수정")}
            onGroupChange={onGroupChange}
            onJoinGroup={() => openGroupOnboarding("appShell")}
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
            onJoinByCode={handleJoinGroup}
            onOpenApprovedGroup={handleOpenApprovedGroup}
            pendingRequests={joinRequests}
          />
        )}
        {route === "interestSetup" && interestGroup !== null && (
          <InterestSelectionScreen
            onBack={handleFinishInterestSetup}
            onComplete={handleFinishInterestSetup}
            onSave={(interests) =>
              onSaveInterests?.({
                groupId: interestGroup.id,
                interests,
              })
            }
            onSkip={handleFinishInterestSetup}
          />
        )}
      </CalendarGatewayProvider>
    </SafeAreaProvider>
  );
}
