import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppShell, currentGroupStore } from "./src/app-shell";
import type {
  AppRoute,
  AiCallResultStatus,
  AppScreenProps,
  AppScreenRenderer,
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
import {
  familyInterestGateway,
  getInterestErrorMessage,
  type InterestGateway,
} from "./src/features/auth/api/interestApi";
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
import { ArchiveScreen, type ArchiveMember } from "./src/features/archive";
import { loadArchive } from "./src/features/archive/api/archiveApi";
import {
  CalendarGatewayProvider,
  CalendarScreen,
  createCalendarHttpGateway,
  type CalendarGateway,
} from "./src/features/calendar";
import { FeedScreen } from "./src/features/feed";
import {
  loadFeedPage,
  loadPostDetail,
} from "./src/features/feed/api/feedApi";
import {
  deletePost,
  submitPost,
} from "./src/features/feed/api/postApi";
import {
  createComment,
  deleteComment,
  loadComments,
  updateComment,
} from "./src/features/feed/api/commentApi";
import { changePostReaction } from "./src/features/feed/api/reactionApi";
import {
  familyGroupMembershipGateway,
  familyGroupMemberGateway,
  familyGroupManagementGateway,
  familyGroupGateway,
  GroupInfoScreen,
  createCarnationGateway,
  type FamilyGroupGateway,
  type GroupMemberGateway,
  type GroupManagementGateway,
  type GroupMembershipGateway,
  type GroupJoinRequestSummary,
  type CarnationGateway,
} from "./src/features/group-info";
import { NotificationsScreen } from "./src/features/notifications";
import { createReportGateway, ReportScreen } from "./src/features/reports";
import type {
  CareReceiverReportTarget,
  ReportGateway,
} from "./src/features/reports";
import { ProfileTabScreen } from "./src/features/profile";
import { API_BASE_URL, ApiError } from "./src/shared/api";

type RootRoute =
  | "welcome"
  | "signup"
  | "signedInWelcome"
  | "groupOnboarding"
  | "interestSetup"
  | "appShell";

type FamilyGroupWithMemberId = FamilyGroup & {
  myMemberId?: string;
};

interface AppProps {
  apiBaseUrl?: string;
  authGateway?: AuthGateway;
  calendarGateway?: CalendarGateway;
  carnationGateway?: CarnationGateway;
  authSession?: AuthSessionCoordinator;
  groupGateway?: FamilyGroupGateway;
  groupMemberGateway?: GroupMemberGateway;
  groupManagementGateway?: GroupManagementGateway;
  groupMembershipGateway?: GroupMembershipGateway;
  interestGateway?: InterestGateway;
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
  onCallResult?: (status: AiCallResultStatus) => void;
  onOpenActiveGroup?: (activeGroupId: string) => void;
  onSaveInterests?: (input: {
    groupId: string;
    interests: readonly string[];
  }) => Promise<void> | void;
  reportGateway?: ReportGateway;
  reportTargetsByGroup?: Readonly<
    Record<string, readonly CareReceiverReportTarget[]>
  >;
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
  carnationGateway: CarnationGateway;
  members: GroupMemberGateway;
  management: GroupManagementGateway;
  membership: GroupMembershipGateway;
  deleteGroup(groupId: string, confirmationName: string): Promise<void>;
  leaveGroup(groupId: string): Promise<void>;
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
      currentMemberId={
        (
          screenProps.currentGroup as typeof screenProps.currentGroup & {
            myMemberId?: string;
          }
        ).myMemberId
      }
      groupDetailLoader={integration.gateway.getGroupDetail}
      inviteCodeLoader={integration.gateway.getInviteCode}
      joinRequestsLoader={integration.membership.loadJoinRequests}
      memberCarnationLoader={integration.carnationGateway.loadMemberCarnations}
      membersLoader={integration.members.loadMembers}
      memberProfileLoader={integration.members.loadMemberProfile}
      rankingLoader={integration.carnationGateway.loadWeeklyRanking}
      onUpdateMemberAlias={(groupId, memberId, alias) =>
        integration.members.updateMemberAlias(groupId, memberId, alias)
      }
      onUpdateMemberRole={(groupId, memberId, role) =>
        integration.members.updateMemberRole(groupId, memberId, role)
      }
      onChangeManager={memberId =>
        integration.management.changeManager(
          screenProps.currentGroup.id,
          memberId,
        ).then(() => undefined)
      }
      onRemoveMember={memberId =>
        integration.management.removeMember(
          screenProps.currentGroup.id,
          memberId,
        )
      }
      onLeaveGroup={() => integration.leaveGroup(screenProps.currentGroup.id)}
      onDeleteGroup={confirmationName =>
        integration.deleteGroup(
          screenProps.currentGroup.id,
          confirmationName,
        )
      }
      onRenameGroup={(name) =>
        integration.renameGroup(screenProps.currentGroup.id, name)
      }
      onProcessJoinRequest={(groupId, input) =>
        integration.membership.processJoinRequest(groupId, input)
      }
    />
  );
}

function ConnectedArchiveScreen(screenProps: AppScreenProps) {
  const integration = useContext(GroupInfoIntegrationContext);
  const usesDevelopmentFixture =
    __DEV__ && screenProps.currentGroup.id.startsWith("development-");
  const loadMembers = useCallback(
    async (groupId: string): Promise<readonly ArchiveMember[]> => {
      if (integration === null) {
        return [];
      }
      const members = await integration.members.loadMembers(groupId);
      return members.map(member => {
        const name = member.alias ?? member.name;
        return {
          avatarText: [...name].slice(0, 2).join("") || "?",
          id: member.memberId,
          name,
        };
      });
    },
    [integration],
  );

  if (integration === null || usesDevelopmentFixture) {
    return <ArchiveScreen {...screenProps} />;
  }

  return (
    <ArchiveScreen
      {...screenProps}
      archiveLoader={loadArchive}
      membersLoader={loadMembers}
    />
  );
}

function ConnectedFeedScreen(screenProps: AppScreenProps) {
  const currentMemberId = (
    screenProps.currentGroup as typeof screenProps.currentGroup & {
      myMemberId?: string;
    }
  ).myMemberId;
  // Keep the explicitly bundled development groups usable in Jest and local
  // UI previews. Real groups returned by the API always use the HTTP gateway.
  const usesDevelopmentFixture =
    __DEV__ && screenProps.currentGroup.id.startsWith("development-");
  const currentUser = usesDevelopmentFixture
    ? undefined
    : currentMemberId && screenProps.currentUserName
      ? {
          avatarText:
            [...screenProps.currentUserName].slice(0, 2).join("") || "?",
          id: currentMemberId,
          name: screenProps.currentUserName,
        }
      : null;

  return (
    <FeedScreen
      {...screenProps}
      commentsLoader={usesDevelopmentFixture ? undefined : loadComments}
      currentMemberId={currentMemberId}
      currentUser={currentUser}
      detailLoader={usesDevelopmentFixture ? undefined : loadPostDetail}
      onChangeReaction={
        usesDevelopmentFixture
          ? undefined
          : input => {
              const reactionId =
                input.nextReactionId ?? input.previousReactionId;
              if (reactionId === null) {
                return Promise.reject(
                  new Error("보낼 반응이 선택되지 않았습니다."),
                );
              }
              return changePostReaction(input.postId, reactionId);
            }
      }
      onConfirmDelete={usesDevelopmentFixture ? undefined : deletePost}
      onCreateComment={usesDevelopmentFixture ? undefined : input =>
        createComment(input.postId, input.body)}
      onDeleteComment={usesDevelopmentFixture ? undefined : input =>
        deleteComment(input.commentId)}
      onSubmitPost={
        usesDevelopmentFixture
          ? undefined
          : (payload, onProgress, signal) =>
              submitPost(
                screenProps.currentGroup.id,
                payload,
                onProgress,
                signal,
              ).then(() => undefined)
      }
      onUpdateComment={usesDevelopmentFixture ? undefined : input =>
        updateComment(input.commentId, input.body)}
      pageLoader={usesDevelopmentFixture ? undefined : loadFeedPage}
    />
  );
}

const DEFAULT_SCREENS: AppScreenRegistry = {
  aiCall: AiCallScreen,
  archive: ConnectedArchiveScreen,
  calendar: CalendarScreen,
  feed: ConnectedFeedScreen,
  groupInfo: ConnectedGroupInfoScreen,
  notifications: NotificationsScreen,
  report: ReportScreen,
  profile: ProfileTabScreen,
};

const DEFAULT_API_BASE_URL = API_BASE_URL;

function createReportScreenRenderer(
  reportGateway: ReportGateway,
  groupMemberGateway: GroupMemberGateway,
  reportTargetsByGroup?: Readonly<
    Record<string, readonly CareReceiverReportTarget[]>
  >
): AppScreenRenderer {
  const loadCareReceiverTargets = async (
    groupId: string
  ): Promise<readonly CareReceiverReportTarget[]> => {
    const members = await groupMemberGateway.loadMembers(groupId);
    return members
      .filter((member) => member.role === "careReceiver")
      .map((member) => ({
        displayName: member.alias ?? member.name,
        memberId: member.memberId,
      }));
  };

  return function ConfiguredReportScreen(screenProps) {
    const configuredTargets =
      reportTargetsByGroup?.[screenProps.currentGroup.id];

    return (
      <ReportScreen
        {...screenProps}
        careReceiverTargets={configuredTargets}
        careReceiverTargetsLoader={
          configuredTargets === undefined ? loadCareReceiverTargets : undefined
        }
        reportGateway={reportGateway}
      />
    );
  };
}

export default function App({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  authGateway = apiAuthGateway,
  calendarGateway,
  carnationGateway,
  authSession = authSessionManager,
  groupGateway = familyGroupGateway,
  groupMemberGateway = familyGroupMemberGateway,
  groupManagementGateway = familyGroupManagementGateway,
  groupMembershipGateway = familyGroupMembershipGateway,
  interestGateway = familyInterestGateway,
  groupStore = currentGroupStore,
  groups,
  initialGroupId,
  initialJoinRequests = [],
  initialRootRoute = "welcome",
  initialShellRoute,
  onCreateGroup,
  onGroupChange,
  onJoinGroup,
  onCallResult,
  onOpenActiveGroup,
  onSaveInterests,
  reportGateway,
  reportTargetsByGroup,
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
  const [interestMemberId, setInterestMemberId] = useState<string | null>(null);
  const [interestInitialValues, setInterestInitialValues] = useState<
    readonly string[]
  >([]);
  const [interestLoadFailed, setInterestLoadFailed] = useState(false);
  const [joinRequests, setJoinRequests] =
    useState<readonly PendingJoinRequest[]>(initialJoinRequests);
  const resolvedCalendarGateway = useMemo(
    () =>
      calendarGateway ??
      createCalendarHttpGateway({
        authSession,
        baseUrl: apiBaseUrl,
      }),
    [apiBaseUrl, authSession, calendarGateway]
  );
  const resolvedReportGateway = useMemo(
    () =>
      reportGateway ??
      createReportGateway({ authSession, baseUrl: apiBaseUrl }),
    [apiBaseUrl, authSession, reportGateway]
  );
  const resolvedCarnationGateway = useMemo(
    () =>
      carnationGateway ??
      createCarnationGateway({ authSession, baseUrl: apiBaseUrl }),
    [apiBaseUrl, authSession, carnationGateway]
  );
  const [authenticationResolved, setAuthenticationResolved] = useState(
    !shouldRestoreSession
  );
  const authInvalidationVersionRef = useRef(0);
  const interestSetupRequestRef = useRef(0);
  const resolvedGroups = availableGroups;

  const clearAuthenticationState = useCallback(() => {
    setUser(null);
    setActiveGroupId(null);
    setAvailableGroups([]);
    setInterestGroup(null);
    setInterestMemberId(null);
    setInterestInitialValues([]);
    setInterestLoadFailed(false);
    interestSetupRequestRef.current += 1;
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

  const resolveInterestMemberId = useCallback(
    async (groupId: string, knownMemberId?: string | null) => {
      if (knownMemberId !== undefined && knownMemberId !== null) {
        return knownMemberId;
      }

      try {
        const snapshot = await groupGateway.loadGroups();
        return (
          snapshot.groups.find((group) => group.id === groupId)?.myMemberId ??
          null
        );
      } catch {
        return null;
      }
    },
    [groupGateway]
  );

  const openInterestSetup = useCallback(
    (
      group: FamilyGroup,
      knownMemberId?: string | null,
      loadExistingInterests = true,
    ) => {
      const requestId = interestSetupRequestRef.current + 1;
      interestSetupRequestRef.current = requestId;
      setInterestGroup(group);
      setInterestMemberId(knownMemberId ?? null);
      setInterestInitialValues([]);
      setInterestLoadFailed(
        onSaveInterests === undefined && loadExistingInterests,
      );
      setRoute("interestSetup");

      void (async () => {
        const memberId = await resolveInterestMemberId(group.id, knownMemberId);
        let initialValues: readonly string[] = [];
        let initialLoadFailed = false;

        if (interestSetupRequestRef.current !== requestId) {
          return;
        }

        if (memberId !== null) {
          setAvailableGroups(current =>
            current.map(item =>
              item.id === group.id ? {...item, myMemberId: memberId} : item,
            ),
          );
        }

        if (
          onSaveInterests === undefined &&
          loadExistingInterests &&
          memberId !== null
        ) {
          try {
            initialValues = (
              await interestGateway.loadInterests(group.id, memberId)
            ).interests;
          } catch (error) {
            if (interestSetupRequestRef.current !== requestId) {
              return;
            }
            Alert.alert(
              "관심사를 불러오지 못했어요",
              getInterestErrorMessage(
                error,
                "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
              ),
            );
            initialLoadFailed = true;
          }
        } else if (onSaveInterests === undefined && loadExistingInterests) {
          if (interestSetupRequestRef.current !== requestId) {
            return;
          }
          Alert.alert(
            "관심사 설정을 준비하지 못했어요",
            "현재 그룹의 구성원 정보를 확인한 뒤 다시 시도해 주세요.",
          );
          initialLoadFailed = true;
        }

        if (interestSetupRequestRef.current !== requestId) {
          return;
        }

        setInterestMemberId(memberId);
        setInterestInitialValues(initialValues);
        setInterestLoadFailed(initialLoadFailed);
      })();
    },
    [
      interestGateway,
      onSaveInterests,
      resolveInterestMemberId,
    ]
  );

  const handleCreateGroup = async (input: CreateGroupInput) => {
    let createdGroup: FamilyGroup;
    let createdMemberId: string | null = null;
    if (onCreateGroup !== undefined) {
      createdGroup = await onCreateGroup(input);
    } else {
      const created = await groupGateway.createGroup(input);
      createdGroup = created.group;
      createdMemberId = created.managerMemberId;
    }
    const groupForState: FamilyGroupWithMemberId =
      createdMemberId === null
        ? createdGroup
        : {...createdGroup, myMemberId: createdMemberId};
    setAvailableGroups((current) => [
      ...current.filter((group) => group.id !== groupForState.id),
      groupForState,
    ]);
    setActiveGroupId(groupForState.id);
    onGroupChange?.(groupForState.id);
    groupStore?.save(groupForState.id).catch(() => {
      // 서버가 확정한 그룹만 저장하고 오류 처리는 상위 앱 계층에 위임한다.
    });
    if (groupForState.role === "careReceiver") {
      await openInterestSetup(groupForState, createdMemberId, false);
      return;
    }
    setRoute("appShell");
  };

  const handleJoinGroup = async (inviteCode: string) => {
    if (onJoinGroup !== undefined) {
      const request = await onJoinGroup(inviteCode);
      setJoinRequests((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== request.id);
        return [...withoutDuplicate, request];
      });
      return;
    }

    if (groupGateway.requestJoinByCode === undefined) {
      showDeferredFeature("코드로 참여");
      return;
    }

    const submitted = await groupGateway.requestJoinByCode(inviteCode);
    const request: PendingJoinRequest = {
      groupId: submitted.groupId,
      groupName: submitted.groupName,
      id: submitted.joinRequestId,
      status: submitted.status,
    };

    try {
      const snapshot = await groupGateway.loadGroups();
      const refreshedRequests = [...toPendingJoinRequests(snapshot.joinRequests)];
      if (!refreshedRequests.some((item) => item.id === request.id)) {
        refreshedRequests.push(request);
      }
      setJoinRequests(refreshedRequests);
      return;
    } catch {
      // 가입 요청은 이미 생성됐으므로 목록 재조회 실패 시 제출 결과를 유지한다.
    }

    setJoinRequests((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== request.id);
      return [...withoutDuplicate, request];
    });
  };

  const handleOpenApprovedGroup = async (request: ApprovedJoinRequest) => {
    const groupId = request.groupId;
    const groupForState: FamilyGroupWithMemberId = {
      id: groupId,
      name: request.groupName,
      role: request.role,
    };
    setAvailableGroups(current => {
      const existingGroup = current.find(group => group.id === groupId) as
        | FamilyGroupWithMemberId
        | undefined;
      if (existingGroup === undefined) {
        return [...current, groupForState];
      }
      return current.map(group =>
        group.id === groupId ? {...existingGroup, ...groupForState} : group,
      );
    });
    setActiveGroupId(groupId);
    onGroupChange?.(groupId);
    groupStore?.save(groupId).catch(() => {
      // 그룹 진입 상태는 유지하고 영속화 오류 처리는 상위 계층에 위임한다.
    });
    if (request.role === "careReceiver") {
      await openInterestSetup(groupForState, groupForState.myMemberId);
      return;
    }
    setRoute("appShell");
    try {
      const snapshot = await groupGateway.loadGroups();
      const loadedGroup = snapshot.groups.find(group => group.id === groupId);
      if (loadedGroup !== undefined) {
        setAvailableGroups(current =>
          current.map(group =>
            group.id === groupId ? {...group, ...loadedGroup} : group,
          ),
        );
      }
    } catch {
      // 그룹 진입은 계속 허용하고, 다음 그룹 목록 갱신에서 memberId를 보완한다.
    }
  };

  const handleFinishInterestSetup = () => {
    interestSetupRequestRef.current += 1;
    setInterestGroup(null);
    setInterestMemberId(null);
    setInterestInitialValues([]);
    setInterestLoadFailed(false);
    setRoute("appShell");
  };

  const handleSaveInterests = async (interests: readonly string[]) => {
    if (interestGroup === null) {
      throw new ApiError({
        code: "INVALID_REQUEST",
        kind: "invalidResponse",
        message: "관심사를 저장할 그룹이 없습니다.",
      });
    }

    if (onSaveInterests !== undefined) {
      await onSaveInterests({
        groupId: interestGroup.id,
        interests,
      });
      return;
    }

    if (interestMemberId === null) {
      throw new ApiError({
        code: "INVALID_REQUEST",
        kind: "invalidResponse",
        message: "현재 그룹의 구성원 정보를 확인할 수 없습니다.",
      });
    }

    if (interestLoadFailed) {
      throw new ApiError({
        code: "INTERESTS_NOT_LOADED",
        kind: "invalidResponse",
        message: "관심사를 먼저 불러온 뒤 저장해 주세요.",
      });
    }

    await interestGateway.replaceInterests(
      interestGroup.id,
      interestMemberId,
      interests,
    );
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

  const removeGroupFromState = useCallback(
    (groupId: string) => {
      const remainingGroups = availableGroups.filter(
        group => group.id !== groupId,
      );
      setAvailableGroups(remainingGroups);

      const nextGroup = remainingGroups[0];
      if (nextGroup === undefined) {
        setActiveGroupId(null);
        setRoute('signedInWelcome');
        return;
      }

      setActiveGroupId(nextGroup.id);
      onGroupChange?.(nextGroup.id);
      groupStore?.save(nextGroup.id).catch(() => {
        // API 작업은 완료됐고 최근 그룹 저장 실패는 다음 진입에서 다시 복구한다.
      });
      setRoute('appShell');
    },
    [availableGroups, groupStore, onGroupChange],
  );

  const handleLeaveGroup = useCallback(
    async (groupId: string) => {
      await groupManagementGateway.leaveGroup(groupId);
      removeGroupFromState(groupId);
    },
    [groupManagementGateway, removeGroupFromState],
  );

  const handleDeleteGroup = useCallback(
    async (groupId: string, confirmationName: string) => {
      await groupManagementGateway.deleteGroup(groupId, confirmationName);
      removeGroupFromState(groupId);
    },
    [groupManagementGateway, removeGroupFromState],
  );

  const groupInfoIntegration = useMemo<GroupInfoIntegration>(
    () => ({
      gateway: groupGateway,
      carnationGateway: resolvedCarnationGateway,
      members: groupMemberGateway,
      management: groupManagementGateway,
      membership: groupMembershipGateway,
      deleteGroup: handleDeleteGroup,
      leaveGroup: handleLeaveGroup,
      renameGroup: handleRenameGroup,
    }),
    [
      groupGateway,
      groupManagementGateway,
      groupMemberGateway,
      groupMembershipGateway,
      handleDeleteGroup,
      handleLeaveGroup,
      handleRenameGroup,
      resolvedCarnationGateway,
    ]
  );
  const resolvedScreens = useMemo<AppScreenRegistry>(
    () =>
      screens ?? {
        ...DEFAULT_SCREENS,
        report: createReportScreenRenderer(
          resolvedReportGateway,
          groupMemberGateway,
          reportTargetsByGroup
        ),
      },
    [
      groupMemberGateway,
      reportTargetsByGroup,
      resolvedReportGateway,
      screens,
    ]
  );

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
            apiBaseUrl={apiBaseUrl}
            authSession={authSession}
            accessToken={authSession.getAccessToken()}
            currentUserId={user?.id}
            currentUserName={user?.name}
            groupStore={groupStore}
            groups={resolvedGroups}
            initialGroupId={activeGroupId}
            initialRoute={initialShellRoute}
            onCreateGroup={() => openGroupOnboarding("appShell")}
            onGroupChange={onGroupChange}
            onJoinGroup={() => openGroupOnboarding("appShell")}
            onCallResult={onCallResult}
            onRequestLogout={handleLogout}
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
            initialInterests={interestInitialValues}
            onBack={handleFinishInterestSetup}
            onComplete={handleFinishInterestSetup}
            onSave={handleSaveInterests}
            onSkip={handleFinishInterestSetup}
          />
        )}
        </CalendarGatewayProvider>
      </SafeAreaProvider>
    </GroupInfoIntegrationContext.Provider>
  );
}
