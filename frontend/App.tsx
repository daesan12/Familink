import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppShell, currentGroupStore } from "./src/app-shell";
import type {
  AppRoute,
  AppScreenProps,
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
import {
  familyGroupGateway,
  GroupInfoScreen,
  type FamilyGroupGateway,
  type GroupJoinRequestSummary,
} from "./src/features/group-info";
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
  groupGateway?: FamilyGroupGateway;
  groupStore?: CurrentGroupStore;
  groups?: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialJoinRequests?: readonly PendingJoinRequest[];
  initialRootRoute?: RootRoute;
  initialShellRoute?: AppRoute;
  onCreateGroup?: (
    input: CreateGroupInput
  ) => FamilyGroup | Promise<FamilyGroup>;
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

function toPendingJoinRequests(
  requests: readonly GroupJoinRequestSummary[]
): readonly PendingJoinRequest[] {
  const pendingRequests: PendingJoinRequest[] = [];
  requests.forEach((request) => {
    if (request.status === "APPROVED") {
      return;
    }
    pendingRequests.push({
      groupId: request.groupId,
      groupName: request.groupName,
      id: request.joinRequestId,
      status: request.status,
    });
  });
  return pendingRequests;
}

interface GroupInfoIntegration {
  gateway: FamilyGroupGateway;
  renameGroup(groupId: string, name: string): Promise<void>;
}

const GroupInfoIntegrationContext = createContext<GroupInfoIntegration | null>(
  null
);

function ConnectedGroupInfoScreen(screenProps: AppScreenProps) {
  const integration = useContext(GroupInfoIntegrationContext);
  if (integration === null) {
    return <GroupInfoScreen {...screenProps} />;
  }

  return (
    <GroupInfoScreen
      {...screenProps}
      groupDetailLoader={integration.gateway.getGroupDetail}
      inviteCodeLoader={integration.gateway.getInviteCode}
      onRenameGroup={(name) =>
        integration.renameGroup(screenProps.currentGroup.id, name)
      }
    />
  );
}

const DEFAULT_SCREENS: AppScreenRegistry = {
  aiCall: AiCallScreen,
  archive: ArchiveScreen,
  calendar: CalendarScreen,
  feed: FeedScreen,
  groupInfo: ConnectedGroupInfoScreen,
  notifications: NotificationsScreen,
};

const DEFAULT_API_BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:8080" : "http://localhost:8080";

export default function App({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  authGateway = apiAuthGateway,
  calendarGateway,
  authSession = authSessionManager,
  groupGateway = familyGroupGateway,
  groupStore = currentGroupStore,
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
  const [availableGroups, setAvailableGroups] = useState<FamilyGroup[]>(() => [
    ...(groups ??
      (initialRootRoute === "appShell" && __DEV__ ? DEVELOPMENT_GROUPS : [])),
  ]);
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
  const authInvalidationVersionRef = useRef(0);
  const resolvedGroups = availableGroups;

  const clearAuthenticationState = useCallback(() => {
    setUser(null);
    setActiveGroupId(null);
    setAvailableGroups([]);
    setInterestGroup(null);
    setJoinRequests([]);
    setGroupOnboardingReturnRoute("welcome");
    setLoginVisible(false);
    setRoute("welcome");
  }, []);

  const enterAuthenticatedState = useCallback(
    async (
      authenticatedUser: AuthenticatedUser,
      shouldApply: () => boolean = () => true
    ) => {
      if (!shouldApply()) {
        return;
      }

      let loadedGroups: readonly FamilyGroup[];
      let loadedJoinRequests: readonly PendingJoinRequest[] | undefined;

      if (groups !== undefined) {
        loadedGroups = groups;
      } else {
        try {
          const snapshot = await groupGateway.loadGroups();
          loadedGroups = snapshot.groups;
          loadedJoinRequests = toPendingJoinRequests(snapshot.joinRequests);
        } catch {
          if (!shouldApply()) {
            return;
          }
          setUser(authenticatedUser);
          setAvailableGroups([]);
          setJoinRequests([]);
          setActiveGroupId(null);
          Alert.alert(
            "그룹 정보를 불러오지 못했어요",
            "네트워크 연결을 확인한 뒤 다시 로그인해 주세요."
          );
          setRoute("signedInWelcome");
          return;
        }
      }

      if (!shouldApply()) {
        return;
      }

      setUser(authenticatedUser);
      setAvailableGroups([...loadedGroups]);
      if (loadedJoinRequests !== undefined) {
        setJoinRequests(loadedJoinRequests);
      }

      if (loadedGroups.length > 0) {
        const requestedGroupId = authenticatedUser.activeGroupId;
        const restorableGroupId = loadedGroups.some(
          (group) => group.id === requestedGroupId
        )
          ? requestedGroupId
          : null;
        setActiveGroupId(restorableGroupId);
        if (restorableGroupId !== null) {
          onOpenActiveGroup?.(restorableGroupId);
        }
        setRoute("appShell");
        return;
      }

      setActiveGroupId(null);
      setRoute("signedInWelcome");
    },
    [groupGateway, groups, onOpenActiveGroup]
  );

  useEffect(() => {
    let disposed = false;
    let invalidated = false;
    const unsubscribe = authSession.subscribeAuthInvalidated(() => {
      invalidated = true;
      authInvalidationVersionRef.current += 1;
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
      .then(async (result) => {
        if (disposed || invalidated) {
          return;
        }
        if (result.status === "authenticated") {
          const restoredUser: AuthenticatedUser = {
            activeGroupId: initialGroupId ?? null,
            id: result.user.id,
            name: result.user.name,
          };
          await enterAuthenticatedState(
            restoredUser,
            () => !disposed && !invalidated
          );
          if (disposed || invalidated) {
            return;
          }
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
    const invalidationVersion = authInvalidationVersionRef.current;
    const authenticatedUser = await authGateway.login(credentials);
    setLoginVisible(false);
    await enterAuthenticatedState(
      authenticatedUser,
      () => authInvalidationVersionRef.current === invalidationVersion
    );
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

  const handleCreateGroup = async (input: CreateGroupInput) => {
    const createdGroup = onCreateGroup
      ? await onCreateGroup(input)
      : (await groupGateway.createGroup(input)).group;
    setAvailableGroups((current) => [
      ...current.filter((group) => group.id !== createdGroup.id),
      createdGroup,
    ]);
    setActiveGroupId(createdGroup.id);
    onGroupChange?.(createdGroup.id);
    groupStore?.save(createdGroup.id).catch(() => {
      // 서버가 확정한 그룹만 저장하고 오류 처리는 상위 앱 계층에 위임한다.
    });
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
    setAvailableGroups((current) => {
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

  const handleRenameGroup = useCallback(
    async (groupId: string, name: string) => {
      const updated = await groupGateway.renameGroup(groupId, name);
      setAvailableGroups((current) =>
        current.map((group) =>
          group.id === updated.id
            ? { ...group, name: updated.name }
            : group
        )
      );
    },
    [groupGateway]
  );

  const groupInfoIntegration = useMemo<GroupInfoIntegration>(
    () => ({ gateway: groupGateway, renameGroup: handleRenameGroup }),
    [groupGateway, handleRenameGroup]
  );
  const resolvedScreens = screens ?? DEFAULT_SCREENS;

  if (!authenticationResolved) {
    return null;
  }

  return (
    <GroupInfoIntegrationContext.Provider value={groupInfoIntegration}>
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
            screens={resolvedScreens}
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
    </GroupInfoIntegrationContext.Provider>
  );
}
