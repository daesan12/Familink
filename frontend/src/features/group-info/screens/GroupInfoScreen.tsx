import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useCallback,
  useEffect,
  useRef,
  useState} from 'react';
import {StackActions,
  useIsFocused} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  } from '@react-navigation/native-stack';
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import type {AppScreenProps, GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {RetryButton} from '../../../shared/components/RetryButton';
import {useHardwareBack} from '../../../shared/hooks/useHardwareBack';
import {DeleteGroupModal} from '../components/DeleteGroupModal';
import {
  GroupMenuSection,
  type GroupMenuItem,
} from '../components/GroupMenuSection';
import {GroupMemberRow} from '../components/GroupMemberRow';
import {ManagerAccessNoticeModal} from '../components/ManagerAccessNoticeModal';
import {MemberProfileModal} from '../components/MemberProfileModal';
import {WeeklyRankingModal} from '../components/WeeklyRankingModal';
import {
  applyAliasChange,
  applyRoleChange,
  canManageRoles as canManageRolesFor,
  clampAliasInput,
  formatMemberCounts,
  formatPendingJoinDescription,
  isAliasSaveable,
  resolveMemberDisplayName,
} from '../groupInfoModel';
import {getCurrentWeekRange, rankEntries} from '../rankingModel';
import {roleLabel} from '../joinRequestModel';
import {resolveManagerName} from '../groupManagementModel';
import {getDevelopmentGroupInfo} from '../fixtures/groupInfoFixtures';
import type {WeeklyRankingLoader} from '../api/rankingApi';
import type {FamilyGroupDetail} from '../api/groupApi';
import type {
  GroupInviteCodeLoader,
  JoinRequestProcessor,
  JoinRequestsLoader,
} from '../api/groupMembershipApi';
import type {
  CarnationCalendar,
  MemberCarnationLoader,
} from '../api/carnationApi';
import type {
  GroupMembersLoader,
  MemberAliasUpdater,
  MemberProfile,
  MemberProfileLoader,
  MemberRoleUpdater,
} from '../api/groupMemberApi';
import {usePendingJoinCount} from '../hooks/usePendingJoinCount';
import {useWeeklyRanking} from '../hooks/useWeeklyRanking';
import type {GroupInfoStackParamList} from '../navigationTypes';
import type {GroupMember} from '../types';
import {ChangeManagerScreen} from './ChangeManagerScreen';
import {GroupCodeScreen} from './GroupCodeScreen';
import {JoinApprovalScreen} from './JoinApprovalScreen';
import {LeaveGroupScreen} from './LeaveGroupScreen';
import {RemoveMemberScreen} from './RemoveMemberScreen';
import {RenameGroupScreen} from './RenameGroupScreen';

export interface GroupInfoScreenProps extends AppScreenProps {
  // 조회자로 간주할 구성원. 방장 여부로 역할 토글 권한을 판단한다.
  currentMemberId?: string;
  initialMembers?: readonly GroupMember[];
  pendingJoinCount?: number;
  // 주간 효자 랭킹 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  rankingLoader?: WeeklyRankingLoader;
  memberCarnationLoader?: MemberCarnationLoader;
  // 그룹 코드·가입 요청 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  groupDetailLoader?: (groupId: string) => Promise<FamilyGroupDetail>;
  membersLoader?: GroupMembersLoader;
  memberProfileLoader?: MemberProfileLoader;
  inviteCodeLoader?: GroupInviteCodeLoader;
  joinRequestsLoader?: JoinRequestsLoader;
  onProcessJoinRequest?: JoinRequestProcessor;
  onUpdateMemberAlias?: MemberAliasUpdater;
  onUpdateMemberRole?: MemberRoleUpdater;
  // 그룹 관리 액션 콜백. API 성공 후에만 로컬 상태를 갱신한다.
  onChangeManager?: (memberId: string) => unknown;
  onRemoveMember?: (memberId: string) => unknown;
  onLeaveGroup?: () => unknown;
  onDeleteGroup?: (confirmationName: string) => unknown;
  onRenameGroup?: (name: string) => Promise<void> | void;
  // 상세 조회가 확인해 준 그룹명을 상위 그룹 목록으로 올린다. 이 화면은 그룹명을
  // 직접 표시하지 않고 currentGroup.name을 쓰므로, 상세의 이름은 이 경로로만 흐른다.
  onGroupNameLoaded?: (groupId: string, name: string) => void;
}

// 그룹정보 탭 내부 스택. 하위 화면 6종이 얼리 리턴 대신 스택 화면으로 열린다.
const GroupInfoStack = createNativeStackNavigator<GroupInfoStackParamList>();

type GroupInfoNavigation = NativeStackNavigationProp<GroupInfoStackParamList>;

// 그룹정보에서 전체화면으로 여는 하위 화면(라우트 이름 기준).
type SubScreenRoute = Exclude<keyof GroupInfoStackParamList, 'GroupInfoHome'>;

// 멤버십이 바뀔 수 있는 하위 화면. 복귀(언마운트) 시 구성원 목록·그룹 상세를
// 다시 조회해 승인·위임·내보내기 등 화면 밖에서 생긴 변경이 반영되게 한다.
const MEMBERSHIP_SUB_SCREENS: readonly SubScreenRoute[] = [
  'JoinApproval',
  'ChangeManager',
  'RemoveMember',
];

// 하위 화면 라우트의 포커스·언마운트를 focusedSubScreen 미러로 동기화한다.
// 반드시 모듈 레벨 유지 — 렌더 본문 안에서 정의하면 매 렌더 리마운트된다.
// unmount cleanup(onClosed)이 기존 closeSubScreen의 복귀 재조회를 대체한다:
// 헤더 뒤로가기·하드웨어 뒤로가기·성공 복귀가 모두 pop 한 번으로 수렴한다.
function SubScreenRouteSync({
  name,
  onClosed,
  onOpened,
}: {
  name: SubScreenRoute;
  onClosed: (name: SubScreenRoute) => void;
  onOpened: (name: SubScreenRoute) => void;
}) {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      onOpened(name);
    }
  }, [isFocused, name, onOpened]);

  useEffect(() => () => onClosed(name), [name, onClosed]);

  return null;
}

const EMPTY_MEMBERS: readonly GroupMember[] = [];

export function GroupInfoScreen({
  currentGroup,
  currentMemberId,
  initialMembers,
  pendingJoinCount,
  rankingLoader,
  memberCarnationLoader,
  groupDetailLoader,
  membersLoader,
  memberProfileLoader,
  inviteCodeLoader,
  joinRequestsLoader,
  onProcessJoinRequest,
  onUpdateMemberAlias,
  onUpdateMemberRole,
  onChangeManager,
  onRemoveMember,
  onLeaveGroup,
  onDeleteGroup,
  onRenameGroup,
  onGroupNameLoaded,
  onFullscreenChange,
}: GroupInfoScreenProps) {
  // 현재 그룹 기준 데이터. props 오버라이드(테스트)가 없으면 그룹 ID로 목업을 조회한다.
  // API 연동 시 이 조회만 서버 응답으로 바꾸면 전환 로직은 그대로 재사용된다.
  const scoped =
    initialMembers !== undefined
      ? {
          members: initialMembers,
          currentMemberId: currentMemberId ?? '',
          pendingJoinCount: pendingJoinCount ?? 0,
        }
      : membersLoader !== undefined
        ? {
            members: EMPTY_MEMBERS,
            currentMemberId: currentMemberId ?? '',
            pendingJoinCount: pendingJoinCount ?? 0,
          }
      : __DEV__
        ? getDevelopmentGroupInfo(currentGroup.id)
        : {
            members: EMPTY_MEMBERS,
            currentMemberId: currentMemberId ?? '',
            pendingJoinCount: pendingJoinCount ?? 0,
          };

  // 주간 효자 랭킹을 비동기로 조회한다(useFeed와 같은 로더/훅 패턴).
  // API 연동 시 rankingLoader만 서버 호출로 바꾸면 화면은 그대로 재사용된다.
  const ranking = useWeeklyRanking(currentGroup.id, rankingLoader);

  const [members, setMembers] = useState<readonly GroupMember[]>(
    scoped.members,
  );
  const membersRef = useRef(members);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isManagerAccessNoticeOpen, setIsManagerAccessNoticeOpen] =
    useState(false);
  // 스택에서 현재 포커스된 하위 화면의 미러. 풀스크린 신호·하드웨어 백
  // 게이트·복귀 재조회가 이 값 하나로 구동된다(FeedScreen selectedPostId 선례).
  const [focusedSubScreen, setFocusedSubScreen] =
    useState<SubScreenRoute | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [scopedGroupId, setScopedGroupId] = useState(currentGroup.id);
  const [membersLoadState, setMembersLoadState] = useState<
    'idle' | 'loading' | 'error'
  >(membersLoader === undefined ? 'idle' : 'loading');
  const [membersLoadError, setMembersLoadError] = useState<string | null>(
    null,
  );
  const [membersReloadCount, setMembersReloadCount] = useState(0);
  const [profileDetails, setProfileDetails] = useState<
    Readonly<Record<string, MemberProfile>>
  >({});
  const [memberCarnationStamps, setMemberCarnationStamps] = useState<
    Readonly<Record<string, readonly boolean[]>>
  >({});
  const [profileLoadState, setProfileLoadState] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [profileLoadError, setProfileLoadError] = useState<string | null>(
    null,
  );
  const [profileReloadCount, setProfileReloadCount] = useState(0);
  const [updatingAliasMemberId, setUpdatingAliasMemberId] = useState<
    string | null
  >(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<
    string | null
  >(null);
  const [groupDetail, setGroupDetail] = useState<FamilyGroupDetail | null>(
    null,
  );
  const [detailReloadCount, setDetailReloadCount] = useState(0);
  const detailRequestVersion = useRef(0);

  // 이동 함수가 effect·핸들러에서도 스택을 조작할 수 있게 렌더 중 ref로
  // 캡처한다(AppShell shellNavRef 관용구). 어느 화면이 포커스여도 위 그룹 전환
  // 정리가 스택을 되감을 수 있어야 하므로 모든 화면에서 캡처한다.
  const groupInfoNavRef = useRef<GroupInfoNavigation | null>(null);
  const previousGroupIdRef = useRef(currentGroup.id);

  const membersRequestVersion = useRef(0);
  const profileRequestVersion = useRef(0);
  // 마지막으로 조회를 마친 그룹. 같은 그룹의 재조회는 기존 데이터를 유지한 채 갱신한다.
  const lastLoadedMembersGroupId = useRef<string | null>(null);
  const lastLoadedDetailGroupId = useRef<string | null>(null);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // 상세 조회 effect가 deps에 콜백을 넣지 않고 최신 참조를 쓰도록 미러링한다.
  // deps에 넣으면 상위가 인라인 함수를 넘기는 순간 재조회 루프가 된다.
  const onGroupNameLoadedRef = useRef(onGroupNameLoaded);
  useEffect(() => {
    onGroupNameLoadedRef.current = onGroupNameLoaded;
  }, [onGroupNameLoaded]);

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(피드 상세·컴포저와 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(focusedSubScreen !== null);

    return () => onFullscreenChange?.(false);
  }, [focusedSubScreen, onFullscreenChange]);

  // 그룹을 전환하면 열려 있던 하위 화면을 홈으로 되돌린다(미러 정리는
  // SubScreenRouteSync cleanup이 이어받는다). 예외는 없다 — 그룹 전환이
  // 동반된 가입 승인 딥링크는 피드 탭 스택으로 가므로 이 스택에 도달하지
  // 않는다(S15P11B104-336, 369).
  useEffect(() => {
    if (previousGroupIdRef.current === currentGroup.id) {
      return;
    }
    previousGroupIdRef.current = currentGroup.id;
    const stackState = groupInfoNavRef.current?.getState();
    const topRoute = stackState?.routes[stackState.index];
    if (topRoute !== undefined && topRoute.name !== 'GroupInfoHome') {
      groupInfoNavRef.current?.dispatch(StackActions.popToTop());
    }
  }, [currentGroup.id]);

  useEffect(() => {
    if (membersLoader === undefined || initialMembers !== undefined) {
      setMembersLoadState('idle');
      setMembersLoadError(null);
      return;
    }

    let isActive = true;
    const requestVersion = membersRequestVersion.current + 1;
    membersRequestVersion.current = requestVersion;
    // 같은 그룹의 재조회는 기존 목록을 보여준 채 갱신한다. 빈 목록 구간이 생기면
    // 인원 수·관리 메뉴 분기가 잘못된 값으로 동작할 수 있다.
    if (lastLoadedMembersGroupId.current !== currentGroup.id) {
      setMembers(EMPTY_MEMBERS);
      setMembersLoadState('loading');
    }
    setMembersLoadError(null);

    membersLoader(currentGroup.id)
      .then(nextMembers => {
        if (isActive && membersRequestVersion.current === requestVersion) {
          lastLoadedMembersGroupId.current = currentGroup.id;
          setMembers(nextMembers);
          setMembersLoadState('idle');
        }
      })
      .catch(() => {
        if (!isActive || membersRequestVersion.current !== requestVersion) {
          return;
        }
        setMembersLoadState('error');
        setMembersLoadError(
          '구성원 정보를 불러오지 못했습니다.\n네트워크와 그룹 권한을 확인해 주세요.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [currentGroup.id, initialMembers, membersLoader, membersReloadCount]);

  useEffect(() => {
    if (
      profileMemberId === null ||
      initialMembers !== undefined ||
      (memberProfileLoader === undefined && memberCarnationLoader === undefined)
    ) {
      setProfileLoadState('idle');
      setProfileLoadError(null);
      return;
    }

    let isActive = true;
    const requestVersion = profileRequestVersion.current + 1;
    profileRequestVersion.current = requestVersion;
    setProfileLoadState('loading');
    setProfileLoadError(null);

    const selectedMember = members.find(
      member => member.memberId === profileMemberId,
    );
    const profileRequest =
      memberProfileLoader === undefined
        ? Promise.resolve(null)
        : memberProfileLoader(currentGroup.id, profileMemberId);
    const carnationRequest =
      memberCarnationLoader === undefined || selectedMember?.role !== 'guardian'
        ? Promise.resolve(null)
        : (() => {
            const week = getCurrentWeekRange(new Date());
            return memberCarnationLoader(
              currentGroup.id,
              profileMemberId,
              week.weekStart,
              week.weekEnd,
            );
          })();

    Promise.allSettled([profileRequest, carnationRequest]).then(
      ([profileResult, carnationResult]) => {
        if (!isActive || profileRequestVersion.current !== requestVersion) {
          return;
        }
        if (
          profileResult.status === 'fulfilled' &&
          profileResult.value !== null
        ) {
          const profile = profileResult.value;
          setProfileDetails(current => ({
            ...current,
            [profile.memberId]: profile,
          }));
        }
        if (
          carnationResult.status === 'fulfilled' &&
          carnationResult.value !== null
        ) {
          const calendar = carnationResult.value;
          setMemberCarnationStamps(current => ({
            ...current,
            [calendar.memberId]: toWeeklyStamps(calendar),
          }));
        }
        if (profileResult.status === 'rejected') {
          setProfileLoadState('error');
          setProfileLoadError('프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
          return;
        }
        if (carnationResult.status === 'rejected') {
          setProfileLoadState('error');
          setProfileLoadError(
            '카네이션 활동을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
          );
          return;
        }
        setProfileLoadState('idle');
      })
      .catch(() => {
        if (!isActive || profileRequestVersion.current !== requestVersion) {
          return;
        }
        setProfileLoadState('error');
        setProfileLoadError(
          '프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [
    currentGroup.id,
    initialMembers,
    memberCarnationLoader,
    memberProfileLoader,
    members,
    profileMemberId,
    profileReloadCount,
  ]);

  useEffect(() => {
    if (groupDetailLoader === undefined) {
      setGroupDetail(null);
      return;
    }

    let isActive = true;
    const requestVersion = detailRequestVersion.current + 1;
    detailRequestVersion.current = requestVersion;
    // 같은 그룹의 재조회는 기존 상세를 유지한 채 갱신한다.
    if (lastLoadedDetailGroupId.current !== currentGroup.id) {
      setGroupDetail(null);
    }
    groupDetailLoader(currentGroup.id)
      .then(detail => {
        if (isActive && detailRequestVersion.current === requestVersion) {
          lastLoadedDetailGroupId.current = currentGroup.id;
          setGroupDetail(detail);
          // 표시용 그룹명은 상위 그룹 목록 하나만 쓴다. 상세가 확인해 준 이름은
          // 화면이 직접 읽지 않고 이 경로로만 올려 화면 간 불일치를 없앤다.
          // stale 가드 안이라 늦게 도착한 옛 이름이 올라가지 않는다.
          onGroupNameLoadedRef.current?.(currentGroup.id, detail.name);
        }
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        Alert.alert(
          '그룹 정보를 불러오지 못했어요',
          '네트워크 연결과 그룹 접근 권한을 확인해 주세요.',
          [
            {text: '닫기'},
            {
              onPress: () => setDetailReloadCount(count => count + 1),
              text: '다시 시도',
            },
          ],
        );
      });

    return () => {
      isActive = false;
    };
  }, [currentGroup.id, detailReloadCount, groupDetailLoader]);

  // 그룹을 전환하면 목록과 편집 중 상태(호칭 편집·임시 입력·열린 프로필)를
  // 새 그룹 기준으로 초기화해 이전 그룹의 상태가 새 그룹에 남지 않게 한다.
  if (currentGroup.id !== scopedGroupId) {
    setScopedGroupId(currentGroup.id);
    setMembers(scoped.members);
    setEditingMemberId(null);
    setAliasDraft('');
    setProfileMemberId(null);
    setProfileDetails({});
    setMemberCarnationStamps({});
    setProfileLoadState('idle');
    setProfileLoadError(null);
    setIsRankingOpen(false);
    setIsManagerAccessNoticeOpen(false);
    setIsDeleteOpen(false);
    setGroupDetail(null);
  }

  const viewerMemberId = scoped.currentMemberId;
  const viewerMembership = members.find(
    member => member.memberId === viewerMemberId,
  );
  const canManageRoles =
    viewerMembership?.isManager ??
    groupDetail?.isManager ??
    (membersLoadState === 'loading' ? currentGroup.isManager : undefined) ??
    canManageRolesFor(members, viewerMemberId);
  // 승인 대기 건수는 관리자만 조회할 수 있는 대기 요청 목록에서 센다.
  // 멤버십이 바뀔 수 있는 하위 화면에서 돌아오면 membersReloadCount가 올라가
  // 승인·거절 결과가 건수에 반영된다.
  const pendingJoinCountState = usePendingJoinCount(
    currentGroup.id,
    joinRequestsLoader,
    canManageRoles,
    membersReloadCount,
  );
  // 로더를 주입하지 않은 개발용 목업 화면은 기존 목업 건수를 그대로 쓴다.
  const waitingDescription =
    joinRequestsLoader === undefined
      ? `승인 요청 ${scoped.pendingJoinCount}건`
      : formatPendingJoinDescription(pendingJoinCountState);
  // 표시용 그룹명은 상위 그룹 목록 하나만 쓴다. 상세 응답의 이름은
  // onGroupNameLoaded로 그 목록에 반영되므로 여기서 다시 읽지 않는다.
  const resolvedGroupName = currentGroup.name;
  const resolvedMemberCount = groupDetail?.memberCount ?? members.length;
  const memberCounts = groupDetail
    ? `피보호자 ${groupDetail.careReceiverCount}명, 보호자 ${groupDetail.guardianCount}명`
    : formatMemberCounts(members);

  const handleStartEditAlias = (member: GroupMember) => {
    setEditingMemberId(member.memberId);
    setAliasDraft(
      member.alias ?? (onUpdateMemberAlias === undefined ? '' : member.name),
    );
  };

  const handleChangeAliasDraft = (value: string) => {
    setAliasDraft(clampAliasInput(value));
  };

  const handleSaveAlias = (memberId: string) => {
    if (
      !isAliasSaveable(aliasDraft) ||
      updatingAliasMemberId !== null ||
      membersLoadState === 'loading'
    ) {
      return;
    }

    if (onUpdateMemberAlias !== undefined) {
      const draft = aliasDraft.trim();
      setUpdatingAliasMemberId(memberId);
      onUpdateMemberAlias(currentGroup.id, memberId, draft)
        .then(result => {
          setMembers(current =>
            current.map(member =>
              member.memberId === result.targetMemberId
                ? {...member, alias: null, name: result.alias}
                : member,
            ),
          );
          setEditingMemberId(null);
          setAliasDraft('');
        })
        .catch(() => {
          Alert.alert(
            '호칭을 저장하지 못했습니다',
            '네트워크와 그룹 권한을 확인한 뒤 다시 시도해 주세요.',
          );
        })
        .finally(() => setUpdatingAliasMemberId(null));
      return;
    }

    setMembers(current => applyAliasChange(current, memberId, aliasDraft));
    setEditingMemberId(null);
    setAliasDraft('');
  };

  const handleCancelEditAlias = () => {
    setEditingMemberId(null);
    setAliasDraft('');
  };

  // 호칭 인라인 편집은 Modal이 아니라 뒤로가기가 JS로 내려오므로 여기서
  // 처리한다. 하위 화면의 뒤로가기는 컨테이너 useBackButton이 스택 pop으로
  // 처리하므로 이 핸들러는 홈 포커스 중에만 활성화한다 — 게이트가 없으면
  // 리스너 LIFO 순서 때문에 하위 화면 위에서 홈의 호칭 편집이 보이지 않게
  // 취소된다.
  useHardwareBack(() => {
    // 저장 중에는 소비만 해 화면을 유지한다(ProfileEditScreen과 같은 관례).
    if (updatingAliasMemberId !== null) {
      return true;
    }
    handleCancelEditAlias();
    return true;
  }, (editingMemberId !== null || updatingAliasMemberId !== null) &&
    focusedSubScreen === null);

  const applyRoleSelection = (member: GroupMember, role: GroupRole) => {
    if (onUpdateMemberRole !== undefined) {
      setUpdatingRoleMemberId(member.memberId);
      onUpdateMemberRole(currentGroup.id, member.memberId, role)
        .then(result => {
          const latestMembers = membersRef.current;
          const previousMember = latestMembers.find(
            candidate => candidate.memberId === result.memberId,
          );
          const nextMembers = applyRoleChange(
            latestMembers,
            result.memberId,
            result.role,
          );
          membersRef.current = nextMembers;
          setMembers(nextMembers);
          setGroupDetail(current => {
            if (
              current === null ||
              previousMember === undefined ||
              previousMember.role === result.role
            ) {
              return current;
            }
            const careReceiverDelta =
              result.role === 'careReceiver' ? 1 : -1;
            return {
              ...current,
              careReceiverCount: current.careReceiverCount + careReceiverDelta,
              guardianCount:
                current.guardianCount - careReceiverDelta,
            };
          });
        })
        .catch(() => {
          Alert.alert(
            '역할을 변경하지 못했습니다',
            '관리자 권한과 구성원 상태를 확인한 뒤 다시 시도해 주세요.',
          );
        })
        .finally(() => setUpdatingRoleMemberId(null));
      return;
    }

    setMembers(current => applyRoleChange(current, member.memberId, role));
  };

  const handleSelectRole = (member: GroupMember, role: GroupRole) => {
    // 이미 같은 역할이면 아무 변화가 없으므로 안내 없이 무시한다.
    if (member.role === role) {
      return;
    }
    if (!canManageRoles) {
      Alert.alert(
        '역할 변경 권한이 없어요',
        '역할은 그룹 관리자(방장)만 변경할 수 있어요.',
      );
      return;
    }

    if (updatingRoleMemberId !== null) {
      return;
    }

    // 오터치 한 번으로 구성원 역할이 바뀌지 않도록 확인 후에만 변경한다.
    Alert.alert(
      '역할을 변경할까요?',
      `${resolveMemberDisplayName(member)}님의 역할을 ${roleLabel(role)}로 변경합니다.`,
      [
        {style: 'cancel', text: '취소'},
        {onPress: () => applyRoleSelection(member, role), text: '변경'},
      ],
    );
  };

  // 하위 화면 라우트 동기화 콜백. cleanup(onClosed)이 기존 closeSubScreen의
  // 멤버십 복귀 재조회를 대체한다 — 어떤 경로(헤더 뒤로가기·하드웨어
  // 뒤로가기·성공 복귀)로 닫혀도 재조회가 항상 따라온다.
  const handleSubScreenOpened = useCallback((name: SubScreenRoute) => {
    setFocusedSubScreen(name);
  }, []);

  const handleSubScreenClosed = useCallback((name: SubScreenRoute) => {
    setFocusedSubScreen(current => (current === name ? null : current));
    if (MEMBERSHIP_SUB_SCREENS.includes(name)) {
      setMembersReloadCount(count => count + 1);
      setDetailReloadCount(count => count + 1);
    }
  }, []);

  // 새 관리자로 위임한다. API 성공 후 로컬 목록의 관리자 표시를 옮긴다.
  // 화면 복귀는 하위 화면이 성공 시 스스로 onBack(=goBack)을 호출하므로
  // 여기서 pop하지 않는다 — 하면 이중 pop이 된다.
  const handleChangeManager = (memberId: string) => {
    const result = onChangeManager?.(memberId);
    const apply = () => {
      setMembers(current =>
        current.map(member => ({
          ...member,
          isManager: member.memberId === memberId,
        })),
      );
      setGroupDetail(current =>
        current === null
          ? current
          : {
              ...current,
              isManager: memberId === viewerMemberId,
              managerMemberId: memberId,
            },
      );
    };

    if (isPromiseLike(result)) {
      return result.then(apply);
    }
    apply();
  };

  // 구성원을 내보낸다. API 성공 후 로컬 목록에서 제거하고 복귀한다.
  const handleRemoveMember = (memberId: string) => {
    const result = onRemoveMember?.(memberId);
    const apply = () => {
      const removedMember = members.find(member => member.memberId === memberId);
      setMembers(current =>
        current.filter(member => member.memberId !== memberId),
      );
      if (removedMember !== undefined) {
        setGroupDetail(current => {
          if (current === null) {
            return current;
          }
          return {
            ...current,
            careReceiverCount:
              current.careReceiverCount -
              (removedMember.role === 'careReceiver' ? 1 : 0),
            guardianCount:
              current.guardianCount -
              (removedMember.role === 'guardian' ? 1 : 0),
            memberCount: Math.max(0, current.memberCount - 1),
          };
        });
      }
    };

    if (isPromiseLike(result)) {
      return result.then(apply);
    }
    apply();
  };

  // 화면 복귀는 LeaveGroupScreen이 성공 시 스스로 onBack을 호출한다.
  const handleLeaveGroup = () => onLeaveGroup?.();

  const handleDeleteGroup = (confirmationName = resolvedGroupName) => {
    const result = onDeleteGroup?.(confirmationName);
    if (isPromiseLike(result)) {
      return result.then(() => setIsDeleteOpen(false));
    }
    setIsDeleteOpen(false);
  };

  const handleRenameGroup = async (name: string) => {
    await onRenameGroup?.(name);
    // 표시용 이름은 상위 그룹 목록이 서버 응답으로 이미 갱신했다. 여기서는
    // 상세의 나머지 필드만 다시 맞춘다. 변경 전에 출발한 상세 응답이 옛 이름을
    // 목록으로 되돌리지 않도록 먼저 무효화한다.
    detailRequestVersion.current += 1;
    setDetailReloadCount(count => count + 1);
  };

  // 관리자 전용 진입점은 한 곳에서 검사해 화면별 권한 문구와 분기가 어긋나지 않게
  // 한다. 게이트가 navigate 앞에서 실행되므로 실패 시 화면이 push되지 않고
  // 풀스크린 신호도 발화하지 않는다. 메뉴에서 관리자 전용 항목을 숨기므로 홈에서는
  // 이 경로를 타지 않지만, 보는 중에 권한을 잃거나 하위 화면에서 재진입하는 경우를
  // 위해 검사는 남긴다.
  //
  // popToTop은 하위 화면이 쌓여 있을 때만 보낸다. 홈에서 보내면 처리할 스택이 없어
  // "The action 'POP_TO_TOP' was not handled by any navigator" 경고가 뜬다.
  const openManagerOnly = (open: () => void) => {
    if (!canManageRoles) {
      const navigation = groupInfoNavRef.current;
      if (navigation !== null && navigation.getState().index > 0) {
        navigation.dispatch(StackActions.popToTop());
      }
      setIsManagerAccessNoticeOpen(true);
      return;
    }
    open();
  };

  const profileMemberBase =
    members.find(member => member.memberId === profileMemberId) ?? null;
  const profileMember =
    profileMemberBase === null
      ? null
      : (() => {
          const profile = profileDetails[profileMemberBase.memberId];
          const rankingEntry =
            ranking.status === 'success'
              ? rankEntries(ranking.snapshot.rankings).find(
                  entry => entry.memberId === profileMemberBase.memberId,
                )
              : undefined;
          return {
            ...profileMemberBase,
            ...(rankingEntry === undefined
              ? {}
              : {
                  previousWeekWinner: rankingEntry.previousWeekWinner,
                  weeklyRank: rankingEntry.rank,
                }),
            ...(memberCarnationStamps[profileMemberBase.memberId] === undefined
              ? {}
              : {
                  weeklyStamps:
                    memberCarnationStamps[profileMemberBase.memberId],
                }),
            ...(profile === undefined
              ? {}
              : {
                  age: profile.age,
                  gender: profile.gender,
                  name: profile.displayName,
                  ...(memberProfileLoader !== undefined ? {alias: null} : {}),
                }),
          };
        })();

  const inviteItems: readonly GroupMenuItem[] = [
    {
      description: '그룹 코드로 초대',
      key: 'invite-code',
      label: '그룹 코드',
      onPress: () => groupInfoNavRef.current?.navigate('GroupCode'),
    },
    {
      description: waitingDescription,
      key: 'join-requests',
      label: '가입 승인 대기',
      managerOnly: true,
      onPress: () =>
        openManagerOnly(() =>
          groupInfoNavRef.current?.navigate('JoinApproval'),
        ),
    },
  ];

  const manageItems: readonly GroupMenuItem[] = [
    {
      description: '관리자 권한을 다른 구성원에게 넘깁니다',
      key: 'change-manager',
      label: '그룹관리자 변경',
      managerOnly: true,
      onPress: () =>
        openManagerOnly(() =>
          groupInfoNavRef.current?.navigate('ChangeManager'),
        ),
    },
    {
      description: '그룹 연결을 해제합니다',
      key: 'remove-member',
      label: '구성원 내보내기',
      managerOnly: true,
      onPress: () =>
        openManagerOnly(() => groupInfoNavRef.current?.navigate('RemoveMember')),
    },
    {
      // 그룹 나가기는 권한과 무관하게 모든 구성원에게 필요하다.
      description: '그룹을 떠납니다',
      key: 'leave-group',
      label: '그룹 나가기',
      onPress: () => {
        if (canManageRoles && resolvedMemberCount <= 1) {
          setIsDeleteOpen(true);
          return;
        }
        groupInfoNavRef.current?.navigate('LeaveGroup');
      },
    },
    {
      description: '전체 구성원에게 영향을 줍니다',
      key: 'delete-group',
      label: '그룹 삭제',
      managerOnly: true,
      onPress: () => openManagerOnly(() => setIsDeleteOpen(true)),
    },
    {
      description: '그룹의 이름을 변경합니다',
      key: 'rename-group',
      label: '그룹명 변경',
      managerOnly: true,
      onPress: () =>
        openManagerOnly(() => groupInfoNavRef.current?.navigate('RenameGroup')),
    },
  ];

  // 관리자 여부가 확정되기 전에는 관리자 전용 항목을 숨긴다. 먼저 보여줬다가
  // 지우면 눌러본 사용자가 권한 안내 팝업을 만나게 되므로 나중에 드러내는 쪽이 낫다.
  const visibleMenuItems = (items: readonly GroupMenuItem[]) =>
    canManageRoles === true ? items : items.filter(item => !item.managerOnly);

  // 홈 본문. 하위 화면이 열려도 스택 아래에서 마운트를 유지하므로 모달 4종과
  // 스크롤 위치가 보존된다(기존 얼리 리턴과 달리 언마운트되지 않음).
  const homeScreenContent = (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <View style={styles.header}>
        <AppText style={styles.title}>그룹 정보</AppText>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityHint="이번 주 가족 카네이션 랭킹을 봅니다"
          accessibilityLabel="이번주 우리 가족 효자 랭킹 조회하기"
          accessibilityRole="button"
          onPress={() => setIsRankingOpen(true)}
          style={styles.rankingCard}>
          <AppText style={styles.rankingText}>
            이번주 우리 가족{'\n'}효자 랭킹 조회하기
          </AppText>
          <View style={styles.rankingChevron}>
            <MaterialDesignIcons
              color={COLORS.background}
              name="chevron-right"
              size={22}
            />
          </View>
        </Pressable>

        <View style={styles.memberCard}>
          <View style={styles.memberCardHeader}>
            <AppText style={styles.memberCardTitle}>그룹 구성원</AppText>
            <AppText style={styles.memberCounts}>{memberCounts}</AppText>
          </View>

          {membersLoadState === 'loading' ? (
            <View accessibilityLabel="구성원 정보를 불러오는 중" style={styles.statusBlock}>
              <ActivityIndicator color={COLORS.purple} />
            </View>
          ) : membersLoadState === 'error' ? (
            <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
              <AppText style={styles.errorText}>{membersLoadError}</AppText>
              <RetryButton
                accessibilityLabel="구성원 정보 다시 시도"
                onPress={() => setMembersReloadCount(count => count + 1)}
              />
            </View>
          ) : members.length === 0 ? (
            <AppText style={styles.emptyMembersText}>현재 구성원이 없습니다.</AppText>
          ) : (
            members.map((member, index) => (
              <View
                key={member.memberId}
                style={[styles.memberRow, index > 0 && styles.memberRowDivider]}>
                <GroupMemberRow
                  aliasDraft={
                    editingMemberId === member.memberId ? aliasDraft : ''
                  }
                  canEditAlias={member.memberId !== viewerMemberId}
                  isEditing={editingMemberId === member.memberId}
                  member={member}
                  onChangeAliasDraft={handleChangeAliasDraft}
                  onOpenProfile={() => {
                    setProfileMemberId(member.memberId);
                    setProfileReloadCount(count => count + 1);
                  }}
                  onCancelEditAlias={handleCancelEditAlias}
                  onSaveAlias={() => handleSaveAlias(member.memberId)}
                  onSelectRole={role => handleSelectRole(member, role)}
                  onStartEditAlias={() => handleStartEditAlias(member)}
                />
              </View>
            ))
          )}
        </View>

        <GroupMenuSection
          items={visibleMenuItems(inviteItems)}
          title="구성원 초대"
        />
        <GroupMenuSection
          items={visibleMenuItems(manageItems)}
          title="그룹 관리"
        />
      </ScrollView>

      <MemberProfileModal
        errorMessage={profileLoadError}
        isLoading={profileLoadState === 'loading'}
        member={profileMember}
        onClose={() => setProfileMemberId(null)}
        onRetry={() => setProfileReloadCount(count => count + 1)}
      />

      <WeeklyRankingModal
        members={members}
        onClose={() => setIsRankingOpen(false)}
        onRetry={ranking.retry}
        state={ranking}
        visible={isRankingOpen}
      />

      <ManagerAccessNoticeModal
        onClose={() => setIsManagerAccessNoticeOpen(false)}
        visible={isManagerAccessNoticeOpen}
      />

      <DeleteGroupModal
        confirmationName={resolvedGroupName}
        onClose={() => setIsDeleteOpen(false)}
        onDeleteGroup={handleDeleteGroup}
        visible={isDeleteOpen}
      />
    </KeyboardAvoidingView>
  );

  return (
    <GroupInfoStack.Navigator
      screenOptions={{animation: 'none', headerShown: false}}>
      <GroupInfoStack.Screen name="GroupInfoHome">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return homeScreenContent;
        }}
      </GroupInfoStack.Screen>
      <GroupInfoStack.Screen name="GroupCode">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return (
            <>
              <SubScreenRouteSync
                name="GroupCode"
                onClosed={handleSubScreenClosed}
                onOpened={handleSubScreenOpened}
              />
              <GroupCodeScreen
                groupId={currentGroup.id}
                loader={inviteCodeLoader}
                onBack={() => navigation.goBack()}
              />
            </>
          );
        }}
      </GroupInfoStack.Screen>
      <GroupInfoStack.Screen name="JoinApproval">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return (
            <>
              <SubScreenRouteSync
                name="JoinApproval"
                onClosed={handleSubScreenClosed}
                onOpened={handleSubScreenOpened}
              />
              <JoinApprovalScreen
                groupId={currentGroup.id}
                loader={joinRequestsLoader}
                onBack={() => navigation.goBack()}
                onProcess={onProcessJoinRequest}
              />
            </>
          );
        }}
      </GroupInfoStack.Screen>
      <GroupInfoStack.Screen name="ChangeManager">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return (
            <>
              <SubScreenRouteSync
                name="ChangeManager"
                onClosed={handleSubScreenClosed}
                onOpened={handleSubScreenOpened}
              />
              <ChangeManagerScreen
                currentMemberId={viewerMemberId}
                members={members}
                onBack={() => navigation.goBack()}
                onChangeManager={handleChangeManager}
              />
            </>
          );
        }}
      </GroupInfoStack.Screen>
      <GroupInfoStack.Screen name="RemoveMember">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return (
            <>
              <SubScreenRouteSync
                name="RemoveMember"
                onClosed={handleSubScreenClosed}
                onOpened={handleSubScreenOpened}
              />
              <RemoveMemberScreen
                currentMemberId={viewerMemberId}
                members={members}
                onBack={() => navigation.goBack()}
                onRemoveMember={handleRemoveMember}
              />
            </>
          );
        }}
      </GroupInfoStack.Screen>
      <GroupInfoStack.Screen name="LeaveGroup">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return (
            <>
              <SubScreenRouteSync
                name="LeaveGroup"
                onClosed={handleSubScreenClosed}
                onOpened={handleSubScreenOpened}
              />
              <LeaveGroupScreen
                groupName={resolvedGroupName}
                isViewerManager={canManageRoles}
                managerName={resolveManagerName(members)}
                memberCount={resolvedMemberCount}
                onBack={() => navigation.goBack()}
                onGoToChangeManager={() =>
                  // 기존 의미론 유지: 관리자 변경에서 뒤로가면 그룹 나가기가
                  // 아니라 그룹정보 루트로 돌아간다 — push 대신 replace.
                  openManagerOnly(() =>
                    navigation.dispatch(StackActions.replace('ChangeManager')),
                  )
                }
                onLeaveGroup={handleLeaveGroup}
              />
            </>
          );
        }}
      </GroupInfoStack.Screen>
      <GroupInfoStack.Screen name="RenameGroup">
        {({navigation}) => {
          groupInfoNavRef.current = navigation;
          return (
            <>
              <SubScreenRouteSync
                name="RenameGroup"
                onClosed={handleSubScreenClosed}
                onOpened={handleSubScreenOpened}
              />
              <RenameGroupScreen
                currentName={resolvedGroupName}
                onBack={() => navigation.goBack()}
                onRenameGroup={handleRenameGroup}
              />
            </>
          );
        }}
      </GroupInfoStack.Screen>
    </GroupInfoStack.Navigator>
  );
}

// resolveMemberDisplayName은 향후 프로필 팝업 연동에서 재사용하기 위해 함께 노출한다.
export {resolveMemberDisplayName};

function toWeeklyStamps(calendar: CarnationCalendar): readonly boolean[] {
  const earnedDates = new Set(calendar.earnedDates);
  const start = new Date(`${calendar.startDate}T00:00:00Z`);
  return Array.from({length: 7}, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return earnedDates.has(date.toISOString().slice(0, 10));
  });
}

function isPromiseLike(value: unknown): value is Promise<void> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyMembersText: {
    color: COLORS.textSubtle,
    fontSize: 14,
    paddingVertical: 20,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  memberCard: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  memberCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
    paddingTop: 12,
  },
  memberCardTitle: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  memberCounts: {
    color: COLORS.textSubtle,
    fontSize: 12,
  },
  memberRow: {
    paddingVertical: 0,
  },
  memberRowDivider: {
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rankingCard: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 96,
    paddingHorizontal: 20,
  },
  rankingChevron: {
    alignItems: 'center',
    backgroundColor: COLORS.purpleDeep,
    borderRadius: RADII.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rankingText: {
    color: COLORS.purpleDeep,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  statusBlock: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
  },
});
