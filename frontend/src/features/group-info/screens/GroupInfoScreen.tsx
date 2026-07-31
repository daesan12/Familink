import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

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
import type {
  GroupInviteCodeLoader,
  JoinRequestsLoader,
} from '../api/groupMembershipApi';
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
  inviteCodeLoader?: GroupInviteCodeLoader;
  joinRequestsLoader?: JoinRequestsLoader;
  // 그룹 관리 액션 콜백(연동·B-3 전환은 후속). 없으면 로컬 상태만 갱신한다.
  onChangeManager?: (memberId: string) => void;
  onRemoveMember?: (memberId: string) => void;
  onLeaveGroup?: () => void;
  onDeleteGroup?: () => void;
  onRenameGroup?: (name: string) => void;
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
  inviteCodeLoader,
  joinRequestsLoader,
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

  const [members, setMembers] = useState<readonly GroupMember[]>(scoped.members);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [subScreen, setSubScreen] = useState<SubScreen | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [scopedGroupId, setScopedGroupId] = useState(currentGroup.id);

  // 하위 전체화면에 들어가면 하단 탭을 숨긴다(피드 상세·컴포저와 같은 방식).
  useEffect(() => {
    onFullscreenChange?.(subScreen !== null);

    return () => onFullscreenChange?.(false);
  }, [subScreen, onFullscreenChange]);

  // 그룹을 전환하면 목록과 편집 중 상태(호칭 편집·임시 입력·열린 프로필)를
  // 새 그룹 기준으로 초기화해 이전 그룹의 상태가 새 그룹에 남지 않게 한다.
  if (currentGroup.id !== scopedGroupId) {
    setScopedGroupId(currentGroup.id);
    setMembers(scoped.members);
    setEditingMemberId(null);
    setAliasDraft('');
    setProfileMemberId(null);
    setIsRankingOpen(false);
    setSubScreen(null);
    setIsDeleteOpen(false);
  }

  const viewerMemberId = scoped.currentMemberId;
  const canManageRoles = canManageRolesFor(members, viewerMemberId);
  const waitingCount = scoped.pendingJoinCount;

  const handleStartEditAlias = (member: GroupMember) => {
    setEditingMemberId(member.memberId);
    setAliasDraft(member.alias ?? '');
  };

  const handleChangeAliasDraft = (value: string) => {
    setAliasDraft(clampAliasInput(value));
  };

  const handleSaveAlias = (memberId: string) => {
    if (!isAliasSaveable(aliasDraft)) {
      return;
    }
    setMembers((current) => applyAliasChange(current, memberId, aliasDraft));
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
    setMembers((current) => applyRoleChange(current, member.memberId, role));
  };

  // 새 관리자로 위임한다. 연동 콜백을 부른 뒤 로컬 목록의 관리자 표시를 옮기고
  // 그룹정보로 복귀한다(실제 권한 전환·재조회는 후속).
  const handleChangeManager = (memberId: string) => {
    onChangeManager?.(memberId);
    setMembers((current) =>
      current.map((member) => ({
        ...member,
        isManager: member.memberId === memberId,
      })),
    );
    setSubScreen(null);
  };

  // 구성원을 내보낸다. 연동 콜백을 부른 뒤 로컬 목록에서 제거하고 복귀한다.
  const handleRemoveMember = (memberId: string) => {
    onRemoveMember?.(memberId);
    setMembers((current) =>
      current.filter((member) => member.memberId !== memberId),
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

  const handleRenameGroup = (name: string) => {
    onRenameGroup?.(name);
    setSubScreen(null);
  };

  const profileMember =
    members.find((member) => member.memberId === profileMemberId) ?? null;

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
        groupName={currentGroup.name}
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
        currentName={currentGroup.name}
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
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          accessibilityHint="이번 주 가족 카네이션 랭킹을 봅니다"
          accessibilityLabel="이번주 우리 가족 효자 랭킹 조회하기"
          accessibilityRole="button"
          onPress={() => setIsRankingOpen(true)}
          style={styles.rankingCard}
        >
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
            <Text style={styles.memberCounts}>
              {formatMemberCounts(members)}
            </Text>
          </View>

          {members.map((member, index) => (
            <View
              key={member.memberId}
              style={[styles.memberRow, index > 0 && styles.memberRowDivider]}
            >
              <GroupMemberRow
                aliasDraft={
                  editingMemberId === member.memberId ? aliasDraft : ''
                }
                isEditing={editingMemberId === member.memberId}
                member={member}
                onChangeAliasDraft={handleChangeAliasDraft}
                onOpenProfile={() => setProfileMemberId(member.memberId)}
                onSaveAlias={() => handleSaveAlias(member.memberId)}
                onSelectRole={(role) => handleSelectRole(member, role)}
                onStartEditAlias={() => handleStartEditAlias(member)}
              />
            </View>
          ))}
        </View>

        <GroupMenuSection items={inviteItems} title="구성원 초대" />
        <GroupMenuSection items={manageItems} title="그룹 관리" />
      </ScrollView>

      <MemberProfileModal
        member={profileMember}
        onClose={() => setProfileMemberId(null)}
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
  title: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
  },
});
