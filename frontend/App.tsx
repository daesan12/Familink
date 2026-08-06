import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

import { AppShell, currentGroupStore } from "./src/app-shell";
import type {
  AiCallResultStatus,
  AppScreenProps,
  AppScreenRenderer,
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
  MainTabRoute,
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
import { SessionRestoreErrorScreen } from "./src/features/auth/screens/SessionRestoreErrorScreen";
import { SignedInWelcomeScreen } from "./src/features/auth/screens/SignedInWelcomeScreen";
import { SignupFlowScreen } from "./src/features/auth/screens/SignupFlowScreen";
import { WelcomeScreen } from "./src/features/auth/screens/WelcomeScreen";
import {
  pendingJoinRequestStore,
  type PendingJoinRequestStore,
} from "./src/features/auth/storage/pendingJoinRequestStore";
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
  type FamilyGroupListSnapshot,
  type GroupMemberGateway,
  type GroupManagementGateway,
  type GroupMembershipGateway,
  type MemberRoleUpdate,
  type CarnationGateway,
} from "./src/features/group-info";
import {
  createNotificationGateway,
  nativeDeviceTokenProvider,
  nativeNotificationTapProvider,
  NotificationGatewayProvider,
  NotificationsScreen,
  resolveNotificationTarget,
  type DeviceTokenProvider,
  type NotificationDeepLinkTarget,
  type NotificationGateway,
  type NotificationTap,
  type NotificationTapProvider,
} from "./src/features/notifications";
import { createReportGateway, ReportScreen } from "./src/features/reports";
import type {
  CareReceiverReportTarget,
  ReportGateway,
} from "./src/features/reports";
import {
  createProfileGateway,
  getProfileSaveErrorMessage,
  getProfileWithdrawErrorMessage,
  ProfileTabScreen,
  type ProfileGateway,
  type ProfileImageAsset,
} from "./src/features/profile";
import {
  API_BASE_URL,
  ApiError,
  subscribeGroupAccessDenied,
} from "./src/shared/api";
import { imageDiskCache } from "./src/shared/media/imageDiskCache";
import type { RootRoute, RootStackParamList } from "./src/navigation/types";

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
  notificationGateway?: NotificationGateway;
  notificationTapProvider?: NotificationTapProvider;
  profileGateway?: ProfileGateway;
  deviceTokenProvider?: DeviceTokenProvider;
  groupStore?: CurrentGroupStore;
  joinRequestStore?: PendingJoinRequestStore;
  groups?: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialJoinRequests?: readonly PendingJoinRequest[];
  initialRootRoute?: RootRoute;
  initialShellRoute?: MainTabRoute;
  onCreateGroup?: (
    input: CreateGroupInput,
    signal?: AbortSignal,
  ) => FamilyGroup | Promise<FamilyGroup>;
  onGroupChange?: (groupId: string) => void;
  onJoinGroup?: (
    inviteCode: string,
    signal?: AbortSignal,
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

interface PendingDeviceTokenRegistration {
  deactivationRequested: boolean;
  generation: number;
  promise: Promise<unknown>;
  sessionVersion: number;
  token: string;
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

function reconcileJoinRequests(
  current: readonly PendingJoinRequest[],
  snapshot: FamilyGroupListSnapshot,
  trackedRequestIds: ReadonlySet<string>,
): readonly PendingJoinRequest[] {
  const serverRequests = new Map(
    snapshot.joinRequests.map(request => [request.joinRequestId, request]),
  );
  const next: PendingJoinRequest[] = [];
  const seenIds = new Set<string>();

  current.forEach(request => {
    const serverRequest = serverRequests.get(request.id);
    if (serverRequest === undefined) {
      next.push(request);
      seenIds.add(request.id);
      return;
    }

    if (serverRequest.status === "APPROVED") {
      if (!trackedRequestIds.has(request.id)) {
        return;
      }
      const group = snapshot.groups.find(
        candidate => candidate.id === serverRequest.groupId,
      );
      if (group === undefined) {
        // The approval and group-list writes can be observed a few milliseconds
        // apart. Keep the pending card until both are visible together.
        next.push(request);
      } else {
        next.push({
          groupId: group.id,
          groupName: group.name,
          id: serverRequest.joinRequestId,
          myMemberId: group.myMemberId,
          role: group.role,
          status: "APPROVED",
        });
      }
      seenIds.add(request.id);
      return;
    }

    if (serverRequest.status === "REJECTED") {
      return;
    }

    next.push({
      groupId: serverRequest.groupId,
      groupName: serverRequest.groupName,
      id: serverRequest.joinRequestId,
      status: serverRequest.status,
    });
    seenIds.add(request.id);
  });

  // Only newly observed pending requests are appended. An already
  // approved request is shown only when the UI had observed its pending state,
  // preventing old history from reopening onboarding unexpectedly.
  snapshot.joinRequests.forEach(request => {
    if (seenIds.has(request.joinRequestId) || request.status === "REJECTED") {
      return;
    }
    if (request.status === "APPROVED") {
      if (!trackedRequestIds.has(request.joinRequestId)) {
        return;
      }
      const group = snapshot.groups.find(
        candidate => candidate.id === request.groupId,
      );
      if (group === undefined) {
        next.push({
          groupId: request.groupId,
          groupName: request.groupName,
          id: request.joinRequestId,
          status: "PENDING_ADMIN",
        });
      } else {
        next.push({
          groupId: group.id,
          groupName: group.name,
          id: request.joinRequestId,
          myMemberId: group.myMemberId,
          role: group.role,
          status: "APPROVED",
        });
      }
      return;
    }
    next.push({
      groupId: request.groupId,
      groupName: request.groupName,
      id: request.joinRequestId,
      status: request.status,
    });
  });

  if (
    next.length === current.length &&
    next.every((request, index) => {
      const previous = current[index];
      return (
        previous !== undefined &&
        request.id === previous.id &&
        request.groupId === previous.groupId &&
        request.groupName === previous.groupName &&
        request.role === previous.role &&
        request.status === previous.status &&
        (request.status !== "APPROVED" ||
          previous.status !== "APPROVED" ||
          request.myMemberId === previous.myMemberId)
      );
    })
  ) {
    return current;
  }
  return next;
}

function reconcileTrackedJoinRequestIds(
  current: ReadonlySet<string>,
  snapshot: FamilyGroupListSnapshot,
): ReadonlySet<string> {
  const next = new Set(current);
  snapshot.joinRequests.forEach(request => {
    if (request.status === "PENDING_ADMIN") {
      next.add(request.joinRequestId);
    } else if (request.status === "REJECTED") {
      next.delete(request.joinRequestId);
    }
  });
  return next;
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
  syncGroupName(groupId: string, name: string): void;
  updateMemberRole(
    groupId: string,
    memberId: string,
    role: FamilyGroup["role"],
  ): Promise<MemberRoleUpdate>;
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
        integration.updateMemberRole(groupId, memberId, role)
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
      onGroupNameLoaded={integration.syncGroupName}
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
  const integration = useContext(GroupInfoIntegrationContext);
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
      membersLoader={
        usesDevelopmentFixture || integration === null
          ? undefined
          : integration.members.loadMembers
      }
      memberProfileLoader={
        usesDevelopmentFixture || integration === null
          ? undefined
          : integration.members.loadMemberProfile
      }
      memberCarnationLoader={
        usesDevelopmentFixture || integration === null
          ? undefined
          : integration.carnationGateway.loadMemberCarnations
      }
      rankingLoader={
        usesDevelopmentFixture || integration === null
          ? undefined
          : integration.carnationGateway.loadWeeklyRanking
      }
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

// 루트 스택. route useState가 단일 소스이며, 매 시점 route에 해당하는 Screen
// 하나만 조건부 등록한다. 등록 Screen이 1개뿐이라 내비게이터의 초기 화면
// fallback이 곧 현재 route가 되어 navigate 호출 없이 전환이 일어난다.
const RootStack = createNativeStackNavigator<RootStackParamList>();

function createProfileScreenRenderer(
  profileGateway: ProfileGateway,
  carnationGateway: CarnationGateway,
): AppScreenRenderer {
  return function ConfiguredProfileScreen(screenProps) {
    return (
      <ProfileTabScreen
        {...screenProps}
        carnationGateway={carnationGateway}
        profileGateway={profileGateway}
      />
    );
  };
}

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
    // 개발 목업 그룹은 서버 조회 없이 리포트 fixture를 그대로 보여준다
    // (피드·보관함의 개발 그룹 처리와 같은 방식).
    const usesDevelopmentFixture =
      __DEV__ && screenProps.currentGroup.id.startsWith("development-");

    if (usesDevelopmentFixture) {
      return <ReportScreen {...screenProps} />;
    }

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
  joinRequestStore = pendingJoinRequestStore,
  notificationGateway: injectedNotificationGateway,
  notificationTapProvider = nativeNotificationTapProvider,
  profileGateway,
  deviceTokenProvider = nativeDeviceTokenProvider,
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
  const routeRef = useRef<RootRoute>(initialRootRoute);
  const [groupOnboardingReturnRoute, setGroupOnboardingReturnRoute] =
    useState<Exclude<RootRoute, "groupOnboarding">>("welcome");
  const [groupOnboardingAction, setGroupOnboardingAction] = useState<
    "create" | "join" | null
  >(null);
  const [appShellEntryRoute, setAppShellEntryRoute] = useState<
    MainTabRoute | undefined
  >(
    initialShellRoute,
  );
  // OS 알림 탭 딥링크 상태. 해석 흐름은 아래 notificationTapProvider effect 참고.
  const [pendingNotificationTap, setPendingNotificationTap] =
    useState<NotificationTap | null>(null);
  const [appShellDeepLink, setAppShellDeepLink] = useState<{
    requestId: number;
    target: NotificationDeepLinkTarget;
  } | null>(null);
  // 소비 후 상태를 비워도 requestId는 단조 증가해야 같은 값 재사용으로 인한
  // 소비 누락이 생기지 않는다.
  const deepLinkRequestSeqRef = useRef(0);
  // 해석 effect는 자기 트리거(pendingNotificationTap)를 즉시 비우므로 cleanup
  // 기반 무효화를 쓸 수 없다. 로그아웃 등으로 세대가 바뀌면 늦은 결과를 버린다.
  const tapResolveGenerationRef = useRef(0);
  const [appShellRecoveryVersion, setAppShellRecoveryVersion] = useState(0);
  const [loginVisible, setLoginVisible] = useState(false);
  // 방금 가입한 로그인 ID. 가입 직후 여는 로그인 시트에 미리 채운다.
  const [signupLoginId, setSignupLoginId] = useState("");
  const [pendingSignupProfileImage, setPendingSignupProfileImage] = useState<{
    asset: ProfileImageAsset;
    loginId: string;
  } | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [activeGroupId, setActiveGroupId] = useState(initialGroupId);
  const selectedGroupIdRef = useRef<string | null | undefined>(initialGroupId);
  const [availableGroups, setAvailableGroups] = useState<FamilyGroup[]>(() => [
    ...(groups ??
      (initialRootRoute === "appShell" && __DEV__ ? DEVELOPMENT_GROUPS : [])),
  ]);
  const availableGroupsRef = useRef<readonly FamilyGroup[]>(availableGroups);
  const [interestGroup, setInterestGroup] = useState<FamilyGroup | null>(null);
  const [interestMemberId, setInterestMemberId] = useState<string | null>(null);
  const [interestInitialValues, setInterestInitialValues] = useState<
    readonly string[]
  >([]);
  const [interestLoadFailed, setInterestLoadFailed] = useState(false);
  const [joinRequests, setJoinRequests] =
    useState<readonly PendingJoinRequest[]>(initialJoinRequests);
  const joinRequestsRef = useRef<readonly PendingJoinRequest[]>(initialJoinRequests);
  const trackedJoinRequestIdsRef = useRef<ReadonlySet<string>>(
    new Set(
      initialJoinRequests
        .filter(request => request.status !== "REJECTED")
        .map(request => request.id),
    ),
  );
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
  const resolvedProfileGateway = useMemo(
    () =>
      profileGateway ??
      createProfileGateway({ authSession, baseUrl: apiBaseUrl }),
    [apiBaseUrl, authSession, profileGateway]
  );
  const resolvedCarnationGateway = useMemo(
    () =>
      carnationGateway ??
      createCarnationGateway({ authSession, baseUrl: apiBaseUrl }),
    [apiBaseUrl, authSession, carnationGateway]
  );
  const resolvedNotificationGateway = useMemo(
    () =>
      injectedNotificationGateway ??
      createNotificationGateway({
        authSession,
        baseUrl: apiBaseUrl,
      }),
    [apiBaseUrl, authSession, injectedNotificationGateway]
  );
  const [authenticationResolved, setAuthenticationResolved] = useState(
    !shouldRestoreSession
  );
  // 세션 복원이 재시도 가능한 오류로 멈춘 상태. 백지 대신 재시도 화면을 보여준다.
  const [sessionRestoreFailed, setSessionRestoreFailed] = useState(false);
  // 재시도 복원 진행 중. 오류 화면을 유지한 채 버튼만 로딩으로 잠근다.
  const [sessionRestoreRetrying, setSessionRestoreRetrying] = useState(false);
  // 복원 effect가 만든 재실행 함수. 재시도 버튼이 disposed/invalidated 가드를 공유해 호출한다.
  const retrySessionRestoreRef = useRef<(() => void) | null>(null);
  // 복원 in-flight 가드. 같은 프레임의 중복 재시도 탭이 복원을 겹쳐 실행하지 않게 한다.
  const sessionRestoreInFlightRef = useRef(false);
  const authInvalidationVersionRef = useRef(0);
  const loginAttemptIdRef = useRef(0);
  const loginAbortControllerRef = useRef<AbortController | null>(null);
  const interestSetupRequestRef = useRef(0);
  const deviceTokenGenerationRef = useRef(0);
  const activeDeviceTokenRef = useRef<string | null>(null);
  const activeDeviceTokenSessionVersionRef = useRef<number | null>(null);
  const deviceTokenLogoutRef = useRef(false);
  const suppressDeviceTokenDeactivationRef = useRef(false);
  const pendingDeviceTokenRegistrationRef =
    useRef<PendingDeviceTokenRegistration | null>(null);
  const deviceTokenDeactivationRef = useRef<Promise<void> | null>(null);
  const withdrawalInFlightRef = useRef<Promise<void> | null>(null);
  // 포그라운드 복귀 갱신 in-flight 가드. 연속 전환에서 그룹 재조회가 겹치지 않게 한다.
  const foregroundGroupRefreshInFlightRef = useRef(false);
  // 그룹 범위 API의 403이 가리킨 그룹. 진행 중인 목록 갱신이 있으면 그 결과에서도
  // 내보내기 여부를 판정할 수 있도록 ref에 보존한다.
  const deniedGroupIdsRef = useRef<Set<string>>(new Set());
  const resolvedGroups = availableGroups;

  useEffect(() => {
    joinRequestsRef.current = joinRequests;
  }, [joinRequests]);

  useLayoutEffect(() => {
    routeRef.current = route;
  }, [route]);

  useEffect(() => {
    availableGroupsRef.current = availableGroups;
  }, [availableGroups]);

  useEffect(() => {
    selectedGroupIdRef.current = activeGroupId;
  }, [activeGroupId]);

  const handleCurrentGroupChange = useCallback((groupId: string) => {
    selectedGroupIdRef.current = groupId;
  }, []);

  const refreshGroupSnapshot = useCallback(async () => {
    if (
      user === null ||
      groups !== undefined ||
      foregroundGroupRefreshInFlightRef.current
    ) {
      return;
    }

    foregroundGroupRefreshInFlightRef.current = true;
    const sessionVersion = authInvalidationVersionRef.current;
    try {
      const snapshot = await groupGateway.loadGroups();
      if (authInvalidationVersionRef.current !== sessionVersion) {
        return;
      }
      const trackedRequestIds = reconcileTrackedJoinRequestIds(
        trackedJoinRequestIdsRef.current,
        snapshot,
      );
      trackedJoinRequestIdsRef.current = trackedRequestIds;
      try {
        await joinRequestStore.save(user.id, [...trackedRequestIds]);
      } catch {
        // 저장 실패가 현재 세션의 서버 상태 갱신까지 막지는 않는다.
      }
      setAvailableGroups([...snapshot.groups]);
      setJoinRequests(current =>
        reconcileJoinRequests(current, snapshot, trackedRequestIds),
      );

      const deniedGroupIds = deniedGroupIdsRef.current;
      deniedGroupIdsRef.current = new Set();
      const selectedGroupId =
        selectedGroupIdRef.current ??
        (availableGroupsRef.current.length === 1
          ? availableGroupsRef.current[0]?.id ?? null
          : null);
      const selectedGroupWasRemoved =
        selectedGroupId !== null &&
        deniedGroupIds.has(selectedGroupId) &&
        availableGroupsRef.current.some(group => group.id === selectedGroupId) &&
        !snapshot.groups.some(group => group.id === selectedGroupId);
      if (
        routeRef.current === "appShell" &&
        selectedGroupWasRemoved
      ) {
        const nextGroup = snapshot.groups[0];
        setAppShellEntryRoute("feed");
        setAppShellRecoveryVersion(version => version + 1);
        if (nextGroup === undefined) {
          selectedGroupIdRef.current = null;
          setActiveGroupId(null);
          setRoute("signedInWelcome");
        } else {
          selectedGroupIdRef.current = nextGroup.id;
          setActiveGroupId(nextGroup.id);
          onGroupChange?.(nextGroup.id);
          groupStore?.save(nextGroup.id).catch(() => {
            // 서버가 확정한 대체 그룹 전환은 유지하고 다음 진입에서 다시 저장한다.
          });
        }
      }
    } catch {
      // Keep the current view when a background refresh fails. The next
      // foreground transition or polling tick will retry it.
    } finally {
      foregroundGroupRefreshInFlightRef.current = false;
    }
  }, [
    groupGateway,
    groupStore,
    groups,
    joinRequestStore,
    onGroupChange,
    user,
  ]);

  const cancelLoginAttempt = useCallback(() => {
    loginAttemptIdRef.current += 1;
    loginAbortControllerRef.current?.abort();
    loginAbortControllerRef.current = null;
  }, []);

  const clearAuthenticationState = useCallback(() => {
    cancelLoginAttempt();
    setUser(null);
    setActiveGroupId(null);
    setAvailableGroups([]);
    setInterestGroup(null);
    setInterestMemberId(null);
    setInterestInitialValues([]);
    setInterestLoadFailed(false);
    interestSetupRequestRef.current += 1;
    setJoinRequests([]);
    joinRequestsRef.current = [];
    trackedJoinRequestIdsRef.current = new Set();
    setAppShellEntryRoute(initialShellRoute);
    setGroupOnboardingReturnRoute("welcome");
    setGroupOnboardingAction(null);
    setLoginVisible(false);
    // 이전 사용자의 알림 탭이 다음 로그인 사용자에게 적용되지 않게 비운다.
    setPendingNotificationTap(null);
    setAppShellDeepLink(null);
    tapResolveGenerationRef.current += 1;
    // 로그아웃 후 다른 사용자가 직전 가입 계정 아이디를 보지 않게 미리 채움을 비운다.
    setSignupLoginId("");
    setRoute("welcome");
  }, [cancelLoginAttempt, initialShellRoute]);

  useEffect(() => cancelLoginAttempt, [cancelLoginAttempt]);

  const registerCurrentDeviceToken = useCallback(
    async (refreshedToken?: string) => {
      await deviceTokenDeactivationRef.current?.catch(() => undefined);
      if (deviceTokenLogoutRef.current) {
        return;
      }
      const generation = ++deviceTokenGenerationRef.current;
      const sessionVersion = authInvalidationVersionRef.current;
      const permission =
        refreshedToken === undefined
          ? await deviceTokenProvider.requestPermission()
          : "granted";
      if (
        permission !== "granted" ||
        generation !== deviceTokenGenerationRef.current ||
        sessionVersion !== authInvalidationVersionRef.current
      ) {
        return;
      }

      const token = refreshedToken ?? (await deviceTokenProvider.getToken());
      if (
        token === null ||
        generation !== deviceTokenGenerationRef.current ||
        sessionVersion !== authInvalidationVersionRef.current
      ) {
        return;
      }

      await deviceTokenDeactivationRef.current?.catch(() => undefined);
      if (
        generation !== deviceTokenGenerationRef.current ||
        sessionVersion !== authInvalidationVersionRef.current
      ) {
        return;
      }
      const previousActiveToken = activeDeviceTokenRef.current;
      const currentPendingRegistration =
        pendingDeviceTokenRegistrationRef.current;
      const pendingRegistration =
        currentPendingRegistration !== null &&
        !currentPendingRegistration.deactivationRequested &&
        currentPendingRegistration.sessionVersion === sessionVersion &&
        currentPendingRegistration.token === token
          ? currentPendingRegistration
          : {
              deactivationRequested: false,
              generation,
              promise: resolvedNotificationGateway.registerDeviceToken(token),
              sessionVersion,
              token,
            };
      pendingRegistration.generation = generation;
      pendingDeviceTokenRegistrationRef.current = pendingRegistration;
      try {
        await pendingRegistration.promise;
      } finally {
        if (
          pendingDeviceTokenRegistrationRef.current === pendingRegistration &&
          pendingRegistration.generation === generation
        ) {
          pendingDeviceTokenRegistrationRef.current = null;
        }
      }
      if (pendingRegistration.generation !== generation) {
        return;
      }
      if (
        generation === deviceTokenGenerationRef.current &&
        sessionVersion === authInvalidationVersionRef.current
      ) {
        activeDeviceTokenRef.current = token;
        activeDeviceTokenSessionVersionRef.current = sessionVersion;
        if (previousActiveToken !== null && previousActiveToken !== token) {
          await resolvedNotificationGateway
            .deactivateDeviceToken(previousActiveToken)
            .catch(() => undefined);
        }
        return;
      }
      const tokenIsStillActiveOrRegistering =
        activeDeviceTokenRef.current === token ||
        pendingDeviceTokenRegistrationRef.current?.token === token;
      if (
        !pendingRegistration.deactivationRequested &&
        !tokenIsStillActiveOrRegistering
      ) {
        await resolvedNotificationGateway
          .deactivateDeviceToken(token)
          .catch(() => undefined);
      }
    },
    [deviceTokenProvider, resolvedNotificationGateway]
  );

  const deactivateCurrentDeviceToken = useCallback(async () => {
    ++deviceTokenGenerationRef.current;
    const previousDeactivation = deviceTokenDeactivationRef.current;
    const deactivation = (async () => {
      await previousDeactivation?.catch(() => undefined);
      const pendingRegistration = pendingDeviceTokenRegistrationRef.current;
      if (pendingRegistration !== null) {
        pendingRegistration.deactivationRequested = true;
      }
      const tokens = new Set<string>();
      if (activeDeviceTokenRef.current !== null) {
        tokens.add(activeDeviceTokenRef.current);
      }
      if (pendingRegistration !== null) {
        tokens.add(pendingRegistration.token);
      }
      activeDeviceTokenRef.current = null;
      activeDeviceTokenSessionVersionRef.current = null;
      if (tokens.size === 0) {
        return;
      }
      await pendingRegistration?.promise.catch(() => undefined);
      for (const token of tokens) {
        await resolvedNotificationGateway.deactivateDeviceToken(token);
      }
    })();
    deviceTokenDeactivationRef.current = deactivation;
    try {
      await deactivation;
    } finally {
      if (deviceTokenDeactivationRef.current === deactivation) {
        deviceTokenDeactivationRef.current = null;
      }
    }
  }, [resolvedNotificationGateway]);

  const cancelCurrentDeviceTokenRegistration = useCallback(async () => {
    ++deviceTokenGenerationRef.current;
    const pendingRegistration = pendingDeviceTokenRegistrationRef.current;
    if (pendingRegistration !== null) {
      pendingRegistration.deactivationRequested = true;
    }

    if (pendingRegistration === null) {
      return null;
    }

    try {
      await pendingRegistration.promise;
      return pendingRegistration.token;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (user === null || deviceTokenProvider.subscribeTokenRefresh === undefined) {
      return;
    }

    return deviceTokenProvider.subscribeTokenRefresh(token => {
      void registerCurrentDeviceToken(token).catch(() => undefined);
    });
  }, [deviceTokenProvider, registerCurrentDeviceToken, user]);

  // OS 알림 탭 딥링크. 콜드 스타트 보관분을 가져오고 이후 탭 이벤트를 구독한다.
  // Activity만 재생성된 탭은 네이티브가 보관만 하므로 포그라운드 복귀 때도 pull한다.
  useEffect(() => {
    let disposed = false;
    const pullPendingTap = () => {
      void notificationTapProvider.consumePendingTap().then(tap => {
        if (!disposed && tap !== null) {
          setPendingNotificationTap(tap);
        }
      });
    };
    pullPendingTap();
    const tapSubscription = notificationTapProvider.subscribeTap(tap => {
      setPendingNotificationTap(tap);
    });
    const appStateSubscription = AppState.addEventListener("change", nextState => {
      if (nextState === "active") {
        pullPendingTap();
      }
    });
    return () => {
      disposed = true;
      tapSubscription();
      appStateSubscription.remove();
    };
  }, [notificationTapProvider]);

  // 푸시 payload에는 notificationId·type만 있으므로(스펙) 알림 목록 첫 페이지에서
  // 해당 알림을 찾아 목적지를 해석한다. 못 찾으면 알림 목록 화면으로 폴백한다.
  // 인증·그룹 준비 전에는 탭을 보관해 두고 appShell 진입 후 소비한다.
  useEffect(() => {
    if (pendingNotificationTap === null || route !== "appShell" || user === null) {
      return;
    }
    const tap = pendingNotificationTap;
    setPendingNotificationTap(null);
    const generation = tapResolveGenerationRef.current;
    void resolvedNotificationGateway
      .loadPage(0)
      .then(page => {
        const notification = page.notifications.find(
          item => item.id === tap.notificationId
        );
        if (notification === undefined) {
          return null;
        }
        void resolvedNotificationGateway
          .markRead(tap.notificationId)
          .catch(() => undefined);
        return resolveNotificationTarget(notification);
      })
      .catch(() => null)
      .then(target => {
        if (generation !== tapResolveGenerationRef.current) {
          return;
        }
        deepLinkRequestSeqRef.current += 1;
        setAppShellDeepLink({
          requestId: deepLinkRequestSeqRef.current,
          target: target ?? { kind: "notifications" },
        });
      });
  }, [pendingNotificationTap, resolvedNotificationGateway, route, user]);

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
      let trackedRequestIds: ReadonlySet<string>;

      try {
        trackedRequestIds = new Set(
          await joinRequestStore.load(authenticatedUser.id),
        );
      } catch {
        trackedRequestIds = new Set();
      }

      if (groups !== undefined) {
        loadedGroups = groups;
      } else {
        try {
          const snapshot = await groupGateway.loadGroups();
          loadedGroups = snapshot.groups;
          trackedRequestIds = reconcileTrackedJoinRequestIds(
            trackedRequestIds,
            snapshot,
          );
          loadedJoinRequests = reconcileJoinRequests(
            joinRequestsRef.current,
            snapshot,
            trackedRequestIds,
          );
          try {
            await joinRequestStore.save(
              authenticatedUser.id,
              [...trackedRequestIds],
            );
          } catch {
            // 저장 실패가 로그인을 막지는 않는다.
          }
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
      trackedJoinRequestIdsRef.current = trackedRequestIds;
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
        if (loadedJoinRequests !== undefined && loadedJoinRequests.length > 0) {
          setGroupOnboardingReturnRoute("appShell");
          setGroupOnboardingAction(null);
          setAppShellEntryRoute("feed");
          setRoute("groupOnboarding");
          return;
        }
        setRoute("appShell");
        setAppShellEntryRoute(initialShellRoute);
        return;
      }

      setActiveGroupId(null);
      if (loadedJoinRequests !== undefined && loadedJoinRequests.length > 0) {
        setGroupOnboardingReturnRoute("signedInWelcome");
        setGroupOnboardingAction(null);
        setRoute("groupOnboarding");
        return;
      }
      setRoute("signedInWelcome");
    },
    [groupGateway, groups, initialShellRoute, joinRequestStore, onOpenActiveGroup]
  );

  useEffect(() => {
    let disposed = false;
    let invalidated = false;
    const unsubscribe = authSession.subscribeAuthInvalidated(() => {
      invalidated = true;
      deviceTokenLogoutRef.current = true;
      authInvalidationVersionRef.current += 1;
      const cleanup = suppressDeviceTokenDeactivationRef.current
        ? cancelCurrentDeviceTokenRegistration()
        : deactivateCurrentDeviceToken();
      void cleanup.catch(() => undefined);
      if (!disposed) {
        clearAuthenticationState();
        setAuthenticationResolved(true);
      }
    });

    if (!shouldRestoreSession) {
      return unsubscribe;
    }

    const runSessionRestore = () => {
      if (sessionRestoreInFlightRef.current) {
        return;
      }
      sessionRestoreInFlightRef.current = true;
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
            void registerCurrentDeviceToken().catch(() => undefined);
            setSessionRestoreFailed(false);
            setSessionRestoreRetrying(false);
            setAuthenticationResolved(true);
            return;
          }
          if (result.status === "signedOut") {
            clearAuthenticationState();
            setSessionRestoreFailed(false);
            setSessionRestoreRetrying(false);
            setAuthenticationResolved(true);
            return;
          }
          // retryableError: 세션을 버리지 않고 재시도 화면으로 전환한다.
          setSessionRestoreFailed(true);
          setSessionRestoreRetrying(false);
        })
        .catch(() => {
          // 확정되지 않은 복원 오류에서는 인증·비로그인 화면을 선택하지 않는다.
          if (!disposed && !invalidated) {
            setSessionRestoreFailed(true);
            setSessionRestoreRetrying(false);
          }
        })
        .finally(() => {
          sessionRestoreInFlightRef.current = false;
        });
    };

    retrySessionRestoreRef.current = runSessionRestore;
    runSessionRestore();

    return () => {
      disposed = true;
      retrySessionRestoreRef.current = null;
      unsubscribe();
    };
  }, [
    authSession,
    clearAuthenticationState,
    enterAuthenticatedState,
    initialGroupId,
    shouldRestoreSession,
    cancelCurrentDeviceTokenRegistration,
    deactivateCurrentDeviceToken,
    registerCurrentDeviceToken,
  ]);

  // 관리자가 변경한 내 역할이 재로그인 없이도 반영되도록, 앱이 포그라운드로
  // 돌아올 때 그룹 목록을 다시 조회한다. 주입된 groups(테스트·프리뷰)는 갱신하지 않는다.
  useEffect(() => {
    if (user === null || groups !== undefined) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        return;
      }
      void refreshGroupSnapshot();
    });

    return () => {
      subscription.remove();
    };
  }, [groups, refreshGroupSnapshot, user]);

  useLayoutEffect(() => {
    if (user === null || groups !== undefined) {
      return;
    }

    return subscribeGroupAccessDenied(groupId => {
      deniedGroupIdsRef.current.add(groupId);
      refreshGroupSnapshot().catch(() => undefined);
    });
  }, [groups, refreshGroupSnapshot, user]);

  useEffect(() => {
    if (
      route !== "groupOnboarding" ||
      user === null ||
      groups !== undefined ||
      !joinRequests.some(request => request.status === "PENDING_ADMIN")
    ) {
      return;
    }

    void refreshGroupSnapshot();
    const interval = setInterval(() => {
      void refreshGroupSnapshot();
    }, 3000);
    return () => clearInterval(interval);
  }, [groups, joinRequests, refreshGroupSnapshot, route, user]);

  const handleLogin = async (credentials: LoginCredentials) => {
    const previousController = loginAbortControllerRef.current;
    const attemptId = ++loginAttemptIdRef.current;
    const controller = new AbortController();
    loginAbortControllerRef.current = controller;
    previousController?.abort();
    const invalidationVersion = authInvalidationVersionRef.current;
    const pendingProfileImage = pendingSignupProfileImage;
    const isCurrentAttempt = () =>
      loginAttemptIdRef.current === attemptId &&
      loginAbortControllerRef.current === controller &&
      !controller.signal.aborted;

    try {
      const authenticatedUser = await authGateway.login(credentials, {
        signal: controller.signal,
      });
      if (
        !isCurrentAttempt() ||
        authInvalidationVersionRef.current !== invalidationVersion
      ) {
        return;
      }
      authInvalidationVersionRef.current += 1;
      const authenticatedSessionVersion = authInvalidationVersionRef.current;
      deviceTokenLogoutRef.current = false;
      suppressDeviceTokenDeactivationRef.current = false;
      setLoginVisible(false);
      await enterAuthenticatedState(
        authenticatedUser,
        () =>
          isCurrentAttempt() &&
          authInvalidationVersionRef.current === authenticatedSessionVersion
      );
      if (
        !isCurrentAttempt() ||
        authInvalidationVersionRef.current !== authenticatedSessionVersion
      ) {
        return;
      }
      if (pendingProfileImage !== null) {
        setPendingSignupProfileImage(current =>
          current === pendingProfileImage ? null : current,
        );
        if (pendingProfileImage.loginId === credentials.loginId) {
          try {
            const profileImageUrl =
              await resolvedProfileGateway.uploadProfileImage(
                pendingProfileImage.asset,
              );
            if (
              !isCurrentAttempt() ||
              authInvalidationVersionRef.current !== authenticatedSessionVersion
            ) {
              return;
            }
            await resolvedProfileGateway.updateCurrentProfile({
              profileImageUrl,
            });
          } catch (error) {
            Alert.alert(
              '프로필 사진 저장 실패',
              `${getProfileSaveErrorMessage(error)}\n마이페이지에서 다시 등록할 수 있어요.`,
            );
          }
        }
      }
      void registerCurrentDeviceToken().catch(() => undefined);
    } finally {
      if (loginAbortControllerRef.current === controller) {
        loginAbortControllerRef.current = null;
      }
    }
  };

  const handleLoginDismiss = () => {
    cancelLoginAttempt();
    setLoginVisible(false);
    // 미리 채움은 가입 직후 1회만 유지한다.
    setSignupLoginId("");
    setPendingSignupProfileImage(null);
  };

  const handleLogout = async () => {
    authInvalidationVersionRef.current += 1;
    deviceTokenLogoutRef.current = true;
    suppressDeviceTokenDeactivationRef.current = false;
    let failure: unknown;
    try {
      await deactivateCurrentDeviceToken();
    } catch (error) {
      failure = error;
    }

    try {
      await authGateway.logout();
    } catch (error) {
      failure ??= error;
    }

    try {
      await authSession.clearLocalSession();
    } catch (error) {
      failure ??= error;
    } finally {
      await imageDiskCache.clearAll().catch(() => undefined);
      clearAuthenticationState();
      setAuthenticationResolved(true);
    }

    if (failure !== undefined) {
      throw failure;
    }
  };

  const handleWithdrawal = () => {
    const existingRequest = withdrawalInFlightRef.current;
    if (existingRequest !== null) {
      return existingRequest;
    }

    const authInvalidationVersion = authInvalidationVersionRef.current;
    const activeTokenAtStart = activeDeviceTokenRef.current;
    const request = (async () => {
      deviceTokenLogoutRef.current = true;
      suppressDeviceTokenDeactivationRef.current = true;
      let settledRegistrationToken: string | null = null;

      try {
        settledRegistrationToken = await cancelCurrentDeviceTokenRegistration();
        await resolvedProfileGateway.withdrawCurrentUser();
      } catch (error) {
        suppressDeviceTokenDeactivationRef.current = false;
        if (authInvalidationVersionRef.current !== authInvalidationVersion) {
          const tokensToDeactivate = new Set<string>();
          if (activeTokenAtStart !== null) {
            tokensToDeactivate.add(activeTokenAtStart);
          }
          if (settledRegistrationToken !== null) {
            tokensToDeactivate.add(settledRegistrationToken);
          }
          const previousDeactivation = deviceTokenDeactivationRef.current;
          const cleanup = (async () => {
            await previousDeactivation?.catch(() => undefined);
            for (const token of tokensToDeactivate) {
              const currentSessionVersion = authInvalidationVersionRef.current;
              const currentPendingRegistration =
                pendingDeviceTokenRegistrationRef.current;
              const belongsToCurrentActiveSession =
                activeDeviceTokenRef.current === token &&
                activeDeviceTokenSessionVersionRef.current ===
                  currentSessionVersion;
              const belongsToCurrentPendingSession =
                currentPendingRegistration?.token === token &&
                currentPendingRegistration.sessionVersion ===
                  currentSessionVersion;
              if (
                belongsToCurrentActiveSession ||
                belongsToCurrentPendingSession
              ) {
                continue;
              }
              if (activeDeviceTokenRef.current === token) {
                activeDeviceTokenRef.current = null;
                activeDeviceTokenSessionVersionRef.current = null;
              }
              if (currentPendingRegistration?.token === token) {
                pendingDeviceTokenRegistrationRef.current = null;
              }
              await resolvedNotificationGateway
                .deactivateDeviceToken(token)
                .catch(() => undefined);
            }
          })();
          deviceTokenDeactivationRef.current = cleanup;
          try {
            await cleanup;
          } finally {
            if (deviceTokenDeactivationRef.current === cleanup) {
              deviceTokenDeactivationRef.current = null;
            }
          }
        } else if (settledRegistrationToken !== null) {
          deviceTokenLogoutRef.current = false;
          const previousActiveToken = activeDeviceTokenRef.current;
          activeDeviceTokenRef.current = settledRegistrationToken;
          activeDeviceTokenSessionVersionRef.current = authInvalidationVersion;
          if (
            previousActiveToken !== null &&
            previousActiveToken !== settledRegistrationToken
          ) {
            await resolvedNotificationGateway
              .deactivateDeviceToken(previousActiveToken)
              .catch(() => undefined);
          }
        } else {
          deviceTokenLogoutRef.current = false;
        }
        throw error;
      }

      let localCleanupFailure: unknown;
      try {
        await authSession.clearLocalSession();
      } catch (error) {
        localCleanupFailure = error;
      }
      await imageDiskCache.clearAll().catch(() => undefined);

      activeDeviceTokenRef.current = null;
      activeDeviceTokenSessionVersionRef.current = null;
      pendingDeviceTokenRegistrationRef.current = null;
      clearAuthenticationState();
      setAuthenticationResolved(true);

      if (localCleanupFailure !== undefined) {
        Alert.alert(
          "회원 탈퇴 완료",
          "계정 탈퇴는 완료되었지만 이 기기의 로컬 로그인 정보 정리가 실패했습니다. 앱을 다시 시작해 주세요.",
        );
      }
    })();

    withdrawalInFlightRef.current = request;
    void request.then(
      () => {
        if (withdrawalInFlightRef.current === request) {
          withdrawalInFlightRef.current = null;
        }
      },
      () => {
        if (withdrawalInFlightRef.current === request) {
          withdrawalInFlightRef.current = null;
        }
      },
    );
    return request;
  };

  const handleSignedInWelcomeWithdrawal = async () => {
    try {
      await handleWithdrawal();
    } catch (error) {
      Alert.alert("회원 탈퇴에 실패했습니다.", getProfileWithdrawErrorMessage(error));
      throw error;
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

  const rememberJoinRequest = useCallback(
    async (requestId: string) => {
      const next = new Set(trackedJoinRequestIdsRef.current);
      next.add(requestId);
      trackedJoinRequestIdsRef.current = next;
      if (user === null) {
        return;
      }
      try {
        await joinRequestStore.save(user.id, [...next]);
      } catch {
        // 현재 세션에서는 계속 추적하고 다음 서버 조회에서 다시 저장한다.
      }
    },
    [joinRequestStore, user],
  );

  const forgetJoinRequest = useCallback(
    async (requestId: string) => {
      const next = new Set(trackedJoinRequestIdsRef.current);
      next.delete(requestId);
      trackedJoinRequestIdsRef.current = next;
      if (user === null) {
        return;
      }
      try {
        await joinRequestStore.save(user.id, [...next]);
      } catch {
        // 카드 제거는 유지하고 저장소 정리는 다음 서버 조회에서 재시도한다.
      }
    },
    [joinRequestStore, user],
  );

  const handleCreateGroup = async (
    input: CreateGroupInput,
    signal: AbortSignal,
  ) => {
    let createdGroup: FamilyGroup;
    let createdMemberId: string | null = null;
    if (onCreateGroup !== undefined) {
      createdGroup = await onCreateGroup(input, signal);
    } else {
      const created = await groupGateway.createGroup(input, signal);
      createdGroup = created.group;
      createdMemberId = created.managerMemberId;
    }
    if (signal.aborted) {
      return;
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
    setAppShellEntryRoute("feed");
    setRoute("appShell");
  };

  const handleJoinGroup = async (
    inviteCode: string,
    signal: AbortSignal,
  ) => {
    if (onJoinGroup !== undefined) {
      const request = await onJoinGroup(inviteCode, signal);
      if (signal.aborted) {
        return;
      }
      await rememberJoinRequest(request.id);
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

    const submitted = await groupGateway.requestJoinByCode(inviteCode, signal);
    if (signal.aborted) {
      return;
    }
    const request: PendingJoinRequest = {
      groupId: submitted.groupId,
      groupName: submitted.groupName,
      id: submitted.joinRequestId,
      status: submitted.status,
    };
    await rememberJoinRequest(request.id);

    try {
      const snapshot = await groupGateway.loadGroups();
      if (signal.aborted) {
        return;
      }
      const trackedRequestIds = reconcileTrackedJoinRequestIds(
        trackedJoinRequestIdsRef.current,
        snapshot,
      );
      trackedJoinRequestIdsRef.current = trackedRequestIds;
      if (user !== null) {
        try {
          await joinRequestStore.save(user.id, [...trackedRequestIds]);
        } catch {
          // 서버 반영 결과는 유지하고 다음 조회에서 저장을 재시도한다.
        }
      }
      setJoinRequests(current =>
        reconcileJoinRequests(
          [
            ...current.filter(item => item.id !== request.id),
            request,
          ],
          snapshot,
          trackedRequestIds,
        ),
      );
      return;
    } catch {
      // 가입 요청은 이미 생성됐으므로 목록 재조회 실패 시 제출 결과를 유지한다.
      if (signal.aborted) {
        return;
      }
    }

    setJoinRequests((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== request.id);
      return [...withoutDuplicate, request];
    });
  };

  const handleOpenApprovedGroup = async (request: ApprovedJoinRequest) => {
    const groupId = request.groupId;
    setJoinRequests(current => current.filter(item => item.id !== request.id));
    void forgetJoinRequest(request.id);
    const groupForState: FamilyGroupWithMemberId = {
      id: groupId,
      myMemberId: request.myMemberId,
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
    setAppShellEntryRoute("feed");
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
    returnRoute: Exclude<RootRoute, "groupOnboarding">,
    action: "create" | "join" | null = null,
  ) => {
    if (returnRoute === "appShell") {
      setAppShellEntryRoute("feed");
    }
    setGroupOnboardingReturnRoute(returnRoute);
    setGroupOnboardingAction(action);
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

  // 그룹 상세 조회가 확인해 준 이름을 그룹 목록에 반영한다. 표시용 그룹명의
  // 단일 출처를 이 목록으로 유지해, 다른 구성원이 바꾼 이름도 상세를 불러온
  // 시점부터 셸 헤더·전환 시트·게시글 상세가 함께 같은 값을 보이게 한다.
  // 새 네트워크 호출을 만들지 않는다.
  const handleGroupNameLoaded = useCallback((groupId: string, name: string) => {
    setAvailableGroups((current) =>
      current.some((group) => group.id === groupId && group.name !== name)
        ? current.map((group) =>
            group.id === groupId ? { ...group, name } : group
          )
        : current
    );
  }, []);

  const handleUpdateMemberRole = useCallback(
    async (groupId: string, memberId: string, role: FamilyGroup["role"]) => {
      const result = await groupMemberGateway.updateMemberRole(
        groupId,
        memberId,
        role,
      );
      setAvailableGroups(current =>
        current.map(group =>
          group.id === result.groupId && group.myMemberId === result.memberId
            ? {...group, role: result.role}
            : group,
        ),
      );
      return result;
    },
    [groupMemberGateway],
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
      syncGroupName: handleGroupNameLoaded,
      updateMemberRole: handleUpdateMemberRole,
    }),
    [
      groupGateway,
      groupManagementGateway,
      groupMemberGateway,
      groupMembershipGateway,
      handleDeleteGroup,
      handleGroupNameLoaded,
      handleLeaveGroup,
      handleRenameGroup,
      handleUpdateMemberRole,
      resolvedCarnationGateway,
    ]
  );
  const resolvedScreens = useMemo<AppScreenRegistry>(
    () =>
      screens ?? {
        ...DEFAULT_SCREENS,
        profile: createProfileScreenRenderer(
          resolvedProfileGateway,
          resolvedCarnationGateway,
        ),
        report: createReportScreenRenderer(
          resolvedReportGateway,
          groupMemberGateway,
          reportTargetsByGroup
        ),
      },
    [
      groupMemberGateway,
      reportTargetsByGroup,
      resolvedProfileGateway,
      resolvedReportGateway,
      resolvedCarnationGateway,
      screens,
    ]
  );

  if (!authenticationResolved) {
    // 복원이 재시도 가능한 오류로 멈추면 백지 대신 안내와 재시도 버튼을 보여준다.
    // 재시도 중에도 화면을 유지하고 버튼만 로딩으로 잠근다.
    return sessionRestoreFailed ? (
      <SessionRestoreErrorScreen
        onRetry={() => {
          if (sessionRestoreInFlightRef.current) {
            return;
          }
          setSessionRestoreRetrying(true);
          retrySessionRestoreRef.current?.();
        }}
        retrying={sessionRestoreRetrying}
      />
    ) : null;
  }

  return (
    <GroupInfoIntegrationContext.Provider value={groupInfoIntegration}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <NotificationGatewayProvider gateway={resolvedNotificationGateway}>
          <CalendarGatewayProvider gateway={resolvedCalendarGateway}>
            {/* edge-to-edge에서는 상태바 배경색 지정이 무시되므로 barStyle만 사용한다. */}
            <StatusBar barStyle="dark-content" />
            <NavigationContainer>
              {/* 기존 조건부 렌더링과 등가 유지를 위해 전환 애니메이션은 사용하지 않는다. */}
              <RootStack.Navigator
                screenOptions={{ animation: "none", headerShown: false }}
              >
                {route === "welcome" && (
                  <RootStack.Screen name="welcome">
                    {() => (
                      <>
                        <WelcomeScreen
                          onStartLogin={() => setLoginVisible(true)}
                          onStartSignup={() => setRoute("signup")}
                        />
                        <LoginBottomSheet
                          initialLoginId={signupLoginId}
                          onDismiss={handleLoginDismiss}
                          onLogin={handleLogin}
                          visible={loginVisible}
                        />
                      </>
                    )}
                  </RootStack.Screen>
                )}
                {route === "signup" && (
                  <RootStack.Screen name="signup">
                    {() => (
                      <SignupFlowScreen
                        onCancel={() => {
                          setPendingSignupProfileImage(null);
                          setRoute("welcome");
                        }}
                        onComplete={(loginId, profileImageAsset) => {
                          // 방금 만든 계정을 다시 입력하지 않도록 아이디를 채운 로그인 시트를 바로 연다.
                          setSignupLoginId(loginId);
                          setPendingSignupProfileImage(
                            profileImageAsset
                              ? {asset: profileImageAsset, loginId}
                              : null,
                          );
                          setRoute("welcome");
                          setLoginVisible(true);
                        }}
                      />
                    )}
                  </RootStack.Screen>
                )}
                {route === "appShell" && (
                  <RootStack.Screen name="appShell">
                    {() => (
                      <AppShell
                        key={appShellRecoveryVersion}
                        apiBaseUrl={apiBaseUrl}
                        authSession={authSession}
                        accessToken={authSession.getAccessToken()}
                        currentUserId={user?.id}
                        currentUserName={user?.name}
                        deepLinkRequestId={appShellDeepLink?.requestId ?? 0}
                        deepLinkTarget={appShellDeepLink?.target ?? null}
                        onDeepLinkConsumed={() => setAppShellDeepLink(null)}
                        groupStore={groupStore}
                        groups={resolvedGroups}
                        initialGroupId={activeGroupId}
                        initialRoute={appShellEntryRoute}
                        onCreateGroup={() => openGroupOnboarding("appShell", "create")}
                        onCurrentGroupChange={handleCurrentGroupChange}
                        onGroupChange={onGroupChange}
                        onJoinGroup={() => openGroupOnboarding("appShell", "join")}
                        onCallResult={onCallResult}
                        onRequestLogout={handleLogout}
                        onRequestWithdrawal={handleWithdrawal}
                        screens={resolvedScreens}
                      />
                    )}
                  </RootStack.Screen>
                )}
                {route === "signedInWelcome" && (
                  <RootStack.Screen name="signedInWelcome">
                    {/* user 가드는 Screen 등록 조건에 두지 않는다. 등록 Screen이
                        0개가 되면 내비게이터가 throw하므로, 가드 불충족 시에는
                        기존의 빈 화면과 등가인 null을 그린다. */}
                    {() =>
                      user !== null ? (
                        <SignedInWelcomeScreen
                          onLogout={handleLogout}
                          onRequestWithdrawal={handleSignedInWelcomeWithdrawal}
                          onStartGroupOnboarding={() =>
                            openGroupOnboarding("signedInWelcome")
                          }
                          userName={user.name}
                        />
                      ) : null
                    }
                  </RootStack.Screen>
                )}
                {route === "groupOnboarding" && (
                  <RootStack.Screen name="groupOnboarding">
                    {() => (
                      <GroupOnboardingScreen
                        hasJoinedGroups={availableGroups.length > 0}
                        initialAction={groupOnboardingAction}
                        onBack={() => {
                          setGroupOnboardingAction(null);
                          setRoute(groupOnboardingReturnRoute);
                        }}
                        onCreateGroup={handleCreateGroup}
                        onJoinByCode={handleJoinGroup}
                        onOpenApprovedGroup={handleOpenApprovedGroup}
                        pendingRequests={joinRequests}
                      />
                    )}
                  </RootStack.Screen>
                )}
                {route === "interestSetup" && (
                  <RootStack.Screen name="interestSetup">
                    {() =>
                      interestGroup !== null ? (
                        <InterestSelectionScreen
                          initialInterests={interestInitialValues}
                          onBack={handleFinishInterestSetup}
                          onComplete={handleFinishInterestSetup}
                          onSave={handleSaveInterests}
                          onSkip={handleFinishInterestSetup}
                        />
                      ) : null
                    }
                  </RootStack.Screen>
                )}
              </RootStack.Navigator>
            </NavigationContainer>
          </CalendarGatewayProvider>
        </NotificationGatewayProvider>
      </SafeAreaProvider>
    </GroupInfoIntegrationContext.Provider>
  );
}
