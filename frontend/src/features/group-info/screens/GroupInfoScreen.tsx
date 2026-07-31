import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef, useState} from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {AppScreenProps, GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {DeleteGroupModal} from '../components/DeleteGroupModal';
import {
  GroupMenuSection,
  type GroupMenuItem,
} from '../components/GroupMenuSection';
import {GroupMemberRow} from '../components/GroupMemberRow';
import {MemberProfileModal} from '../components/MemberProfileModal';
import {WeeklyRankingModal} from '../components/WeeklyRankingModal';
import {
  applyAliasChange,
  applyRoleChange,
  canManageRoles as canManageRolesFor,
  clampAliasInput,
  formatMemberCounts,
  isAliasSaveable,
  resolveMemberDisplayName,
} from '../groupInfoModel';
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
  GroupMembersLoader,
  MemberAliasUpdater,
  MemberProfile,
  MemberProfileLoader,
  MemberRoleUpdater,
} from '../api/groupMemberApi';
import {useWeeklyRanking} from '../hooks/useWeeklyRanking';
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
  // 가족 기록 개수. 계약 밖 목업값이며 H-8 그룹 나가기 요약 카드에 쓴다.
  recordCount?: number;
  // 주간 효자 랭킹 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  rankingLoader?: WeeklyRankingLoader;
  // 그룹 코드·가입 요청 로더 주입(테스트·연동용). 없으면 기본 로더로 조회한다.
  groupDetailLoader?: (groupId: string) => Promise<FamilyGroupDetail>;
  membersLoader?: GroupMembersLoader;
  memberProfileLoader?: MemberProfileLoader;
  inviteCodeLoader?: GroupInviteCodeLoader;
  joinRequestsLoader?: JoinRequestsLoader;
  onProcessJoinRequest?: JoinRequestProcessor;
  onUpdateMemberAlias?: MemberAliasUpdater;
  onUpdateMemberRole?: MemberRoleUpdater;
  // 그룹 관리 액션 콜백(연동·B-3 전환은 후속). 없으면 로컬 상태만 갱신한다.
  onChangeManager?: (memberId: string) => void;
  onRemoveMember?: (memberId: string) => void;
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
  onRenameGroup?: (name: string) => Promise<void> | void;
}

// 그룹정보에서 전체화면으로 여는 하위 화면.
type SubScreen =
  | 'groupCode'
  | 'joinApproval'
  | 'changeManager'
  | 'removeMember'
  | 'leaveGroup'
  | 'renameGroup';

const EMPTY_MEMBERS: readonly GroupMember[] = [];

export function GroupInfoScreen({
  currentGroup,
  currentMemberId,
  initialMembers,
  pendingJoinCount,
  recordCount,
  rankingLoader,
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
          recordCount: recordCount ?? 0,
        }
      : membersLoader !== undefined
        ? {
            members: EMPTY_MEMBERS,
            currentMemberId: currentMemberId ?? '',
            pendingJoinCount: pendingJoinCount ?? 0,
            recordCount: recordCount ?? 0,
          }
      : __DEV__
        ? getDevelopmentGroupInfo(currentGroup.id)
        : {
            members: EMPTY_MEMBERS,
            currentMemberId: currentMemberId ?? '',
            pendingJoinCount: pendingJoinCount ?? 0,
            recordCount: recordCount ?? 0,
          };

  // 주간 효자 랭킹을 비동기로 조회한다(useFeed와 같은 로더/훅 패턴).
  // API 연동 시 rankingLoader만 서버 호출로 바꾸면 화면은 그대로 재사용된다.
  const ranking = useWeeklyRanking(currentGroup.id, rankingLoader);

  const [members, setMembers] = useState<readonly GroupMember[]>(
    scoped.members,
  );
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [subScreen, setSubScreen] = useState<SubScreen | null>(null);
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
  const membersRequestVersion = useRef(0);
  const profileRequestVersion = useRef(0);

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(피드 상세·컴포저와 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(subScreen !== null);

    return () => onFullscreenChange?.(false);
  }, [subScreen, onFullscreenChange]);

  useEffect(() => {
    if (membersLoader === undefined || initialMembers !== undefined) {
      setMembersLoadState('idle');
      setMembersLoadError(null);
      return;
    }

    let isActive = true;
    const requestVersion = membersRequestVersion.current + 1;
    membersRequestVersion.current = requestVersion;
    setMembers(EMPTY_MEMBERS);
    setMembersLoadState('loading');
    setMembersLoadError(null);

    membersLoader(currentGroup.id)
      .then(nextMembers => {
        if (isActive && membersRequestVersion.current === requestVersion) {
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
          '구성원 정보를 불러오지 못했습니다. 네트워크와 그룹 권한을 확인해 주세요.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [currentGroup.id, initialMembers, membersLoader, membersReloadCount]);

  useEffect(() => {
    if (
      profileMemberId === null ||
      memberProfileLoader === undefined ||
      initialMembers !== undefined
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

    memberProfileLoader(currentGroup.id, profileMemberId)
      .then(profile => {
        if (isActive && profileRequestVersion.current === requestVersion) {
          setProfileDetails(current => ({
            ...current,
            [profile.memberId]: profile,
          }));
          setProfileLoadState('idle');
        }
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
    memberProfileLoader,
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
    setGroupDetail(null);
    groupDetailLoader(currentGroup.id)
      .then(detail => {
        if (isActive && detailRequestVersion.current === requestVersion) {
          setGroupDetail(detail);
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
    setProfileLoadState('idle');
    setProfileLoadError(null);
    setIsRankingOpen(false);
    setSubScreen(null);
    setIsDeleteOpen(false);
    setGroupDetail(null);
  }

  const viewerMemberId = scoped.currentMemberId;
  const canManageRoles =
    groupDetail?.isManager ?? canManageRolesFor(members, viewerMemberId);
  const waitingCount = scoped.pendingJoinCount;
  const resolvedGroupName = groupDetail?.name ?? currentGroup.name;
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

    if (onUpdateMemberRole !== undefined) {
      setUpdatingRoleMemberId(member.memberId);
      onUpdateMemberRole(currentGroup.id, member.memberId, role)
        .then(result => {
          setMembers(current =>
            applyRoleChange(current, result.memberId, result.role),
          );
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

  // 새 관리자로 위임한다. 연동 콜백을 부른 뒤 로컬 목록의 관리자 표시를 옮기고
  // 그룹정보로 복귀한다(실제 권한 전환·재조회는 후속).
  const handleChangeManager = (memberId: string) => {
    onChangeManager?.(memberId);
    setMembers(current =>
      current.map(member => ({
        ...member,
        isManager: member.memberId === memberId,
      })),
    );
    setSubScreen(null);
  };

  // 구성원을 내보낸다. 연동 콜백을 부른 뒤 로컬 목록에서 제거하고 복귀한다.
  const handleRemoveMember = (memberId: string) => {
    onRemoveMember?.(memberId);
    setMembers(current =>
      current.filter(member => member.memberId !== memberId),
    );
    setSubScreen(null);
  };

  const handleLeaveGroup = () => {
    onLeaveGroup?.();
    setSubScreen(null);
  };

  const handleDeleteGroup = () => {
    onDeleteGroup?.();
    setIsDeleteOpen(false);
  };

  const handleRenameGroup = async (name: string) => {
    await onRenameGroup?.(name);
    detailRequestVersion.current += 1;
    setGroupDetail(current =>
      current === null ? current : {...current, name},
    );
    setDetailReloadCount(count => count + 1);
  };

  const profileMemberBase =
    members.find(member => member.memberId === profileMemberId) ?? null;
  const profileMember =
    profileMemberBase === null
      ? null
      : (() => {
          const profile = profileDetails[profileMemberBase.memberId];
          return profile === undefined
            ? profileMemberBase
            : {
                ...profileMemberBase,
                age: profile.age,
                gender: profile.gender,
                name: profile.displayName,
                ...(memberProfileLoader !== undefined ? {alias: null} : {}),
              };
        })();

  const inviteItems: readonly GroupMenuItem[] = [
    {
      description: '그룹 코드로 초대',
      key: 'invite-code',
      label: '그룹 코드',
      onPress: () => setSubScreen('groupCode'),
    },
    {
      description: `승인 요청 ${waitingCount}건`,
      key: 'join-requests',
      label: '가입 승인 대기',
      onPress: () => setSubScreen('joinApproval'),
    },
  ];

  const manageItems: readonly GroupMenuItem[] = [
    {
      description: '관리자 권한을 다른 구성원에게 넘깁니다',
      key: 'change-manager',
      label: '그룹관리자 변경',
      onPress: () => setSubScreen('changeManager'),
    },
    {
      description: '그룹 연결을 해제합니다',
      key: 'remove-member',
      label: '구성원 내보내기',
      onPress: () => setSubScreen('removeMember'),
    },
    {
      description: '그룹을 떠납니다',
      key: 'leave-group',
      label: '그룹 나가기',
      onPress: () => setSubScreen('leaveGroup'),
    },
    {
      description: '전체 구성원에게 영향을 줍니다',
      key: 'delete-group',
      label: '그룹 삭제',
      onPress: () => setIsDeleteOpen(true),
    },
    {
      description: '그룹의 이름을 변경합니다',
      key: 'rename-group',
      label: '그룹명 변경',
      onPress: () => setSubScreen('renameGroup'),
    },
  ];

  if (subScreen === 'changeManager') {
    return (
      <ChangeManagerScreen
        currentMemberId={viewerMemberId}
        members={members}
        onBack={() => setSubScreen(null)}
        onChangeManager={handleChangeManager}
      />
    );
  }

  if (subScreen === 'removeMember') {
    return (
      <RemoveMemberScreen
        currentMemberId={viewerMemberId}
        members={members}
        onBack={() => setSubScreen(null)}
        onRemoveMember={handleRemoveMember}
      />
    );
  }

  if (subScreen === 'leaveGroup') {
    return (
      <LeaveGroupScreen
        groupName={resolvedGroupName}
        isViewerManager={canManageRoles}
        managerName={resolveManagerName(members)}
        memberCount={members.length}
        onBack={() => setSubScreen(null)}
        onGoToChangeManager={() => setSubScreen('changeManager')}
        onLeaveGroup={handleLeaveGroup}
        recordCount={scoped.recordCount}
      />
    );
  }

  if (subScreen === 'renameGroup') {
    return (
      <RenameGroupScreen
        currentName={resolvedGroupName}
        onBack={() => setSubScreen(null)}
        onRenameGroup={handleRenameGroup}
      />
    );
  }

  if (subScreen === 'groupCode') {
    return (
      <GroupCodeScreen
        groupId={currentGroup.id}
        loader={inviteCodeLoader}
        onBack={() => setSubScreen(null)}
      />
    );
  }

  if (subScreen === 'joinApproval') {
    return (
      <JoinApprovalScreen
        groupId={currentGroup.id}
        loader={joinRequestsLoader}
        onBack={() => setSubScreen(null)}
        onProcess={onProcessJoinRequest}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>그룹 정보</Text>
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
          <Text style={styles.rankingText}>
            이번주 우리 가족 효자{'\n'}랭킹 조회하기
          </Text>
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
            <Text style={styles.memberCardTitle}>그룹 구성원</Text>
            <Text style={styles.memberCounts}>{memberCounts}</Text>
          </View>

          {membersLoadState === 'loading' ? (
            <View accessibilityLabel="구성원 정보를 불러오는 중" style={styles.statusBlock}>
              <ActivityIndicator color={COLORS.purple} />
            </View>
          ) : membersLoadState === 'error' ? (
            <View accessibilityLiveRegion="polite" style={styles.statusBlock}>
              <Text style={styles.errorText}>{membersLoadError}</Text>
              <Pressable
                accessibilityLabel="구성원 정보 다시 시도"
                accessibilityRole="button"
                onPress={() => setMembersReloadCount(count => count + 1)}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          ) : members.length === 0 ? (
            <Text style={styles.emptyMembersText}>현재 구성원이 없습니다.</Text>
          ) : (
            members.map((member, index) => (
              <View
                key={member.memberId}
                style={[styles.memberRow, index > 0 && styles.memberRowDivider]}>
                <GroupMemberRow
                  aliasDraft={
                    editingMemberId === member.memberId ? aliasDraft : ''
                  }
                  isEditing={editingMemberId === member.memberId}
                  member={member}
                  onChangeAliasDraft={handleChangeAliasDraft}
                  onOpenProfile={() => {
                    setProfileMemberId(member.memberId);
                    setProfileReloadCount(count => count + 1);
                  }}
                  onSaveAlias={() => handleSaveAlias(member.memberId)}
                  onSelectRole={role => handleSelectRole(member, role)}
                  onStartEditAlias={() => handleStartEditAlias(member)}
                />
              </View>
            ))
          )}
        </View>

        <GroupMenuSection items={inviteItems} title="구성원 초대" />
        <GroupMenuSection items={manageItems} title="그룹 관리" />
      </ScrollView>

      <MemberProfileModal
        errorMessage={profileLoadError}
        isLoading={profileLoadState === 'loading'}
        member={profileMember}
        onClose={() => setProfileMemberId(null)}
        onRetry={() => setProfileReloadCount(count => count + 1)}
      />

      <WeeklyRankingModal
        onClose={() => setIsRankingOpen(false)}
        onRetry={ranking.retry}
        state={ranking}
        visible={isRankingOpen}
      />

      <DeleteGroupModal
        onClose={() => setIsDeleteOpen(false)}
        onDeleteGroup={handleDeleteGroup}
        visible={isDeleteOpen}
      />
    </View>
  );
}

// resolveMemberDisplayName은 향후 프로필 팝업 연동에서 재사용하기 위해 함께 노출한다.
export {resolveMemberDisplayName};

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
    backgroundColor: COLORS.textMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 96,
    paddingHorizontal: 20,
  },
  rankingChevron: {
    alignItems: 'center',
    backgroundColor: COLORS.overlay,
    borderRadius: RADII.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  rankingText: {
    color: COLORS.background,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  retryButton: {
    alignItems: 'center',
    borderColor: COLORS.divider,
    borderRadius: RADII.pill,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 16,
  },
  retryText: {
    color: COLORS.textStrong,
    fontSize: 13,
    fontWeight: '700',
  },
  statusBlock: {
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
});
