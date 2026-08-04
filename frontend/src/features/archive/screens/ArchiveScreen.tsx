import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {BackButton} from '../../../shared/components/BackButton';
import {RetryButton} from '../../../shared/components/RetryButton';
import type {ArchiveLoader} from '../api/archiveApi';
import {
  filterPosts,
  formatDateLabel,
  groupPostsByDate,
  parseDateKey,
} from '../archiveModel';
import {ArchiveCalendarModal} from '../components/ArchiveCalendarModal';
import {ArchiveDateSection} from '../components/ArchiveDateSection';
import {ArchiveMemberFilter} from '../components/ArchiveMemberFilter';
import {
  DEVELOPMENT_ARCHIVE_MEMBERS,
  DEVELOPMENT_ARCHIVE_POSTS,
} from '../fixtures/archiveFixtures';
import type {
  ArchiveMember,
  ArchiveMemberFilter as MemberFilter,
  ArchivePost,
} from '../types';

export interface ArchiveScreenProps extends AppScreenProps {
  archiveLoader?: ArchiveLoader;
  initialMembers?: readonly ArchiveMember[];
  initialPosts?: readonly ArchivePost[];
  membersLoader?: (groupId: string) => Promise<readonly ArchiveMember[]>;
}

const EMPTY_MEMBERS: readonly ArchiveMember[] = [];
const EMPTY_POSTS: readonly ArchivePost[] = [];
const FALLBACK_MONTH = {month: 7, year: 2026};

function computeInitialMonth(posts: readonly ArchivePost[]): {
  month: number;
  year: number;
} {
  const latestDateKey = posts.reduce<string | null>(
    (latest, post) =>
      latest == null || post.dateKey > latest ? post.dateKey : latest,
    null,
  );
  if (latestDateKey == null) {
    return FALLBACK_MONTH;
  }
  const {month, year} = parseDateKey(latestDateKey);
  return {month, year};
}

export function ArchiveScreen({
  archiveLoader,
  initialMembers,
  initialPosts,
  membersLoader,
  currentGroup,
  onCloseArchive,
  onOpenPost,
}: ArchiveScreenProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<MemberFilter>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [remoteMembers, setRemoteMembers] = useState<readonly ArchiveMember[]>(
    EMPTY_MEMBERS,
  );
  const [remotePosts, setRemotePosts] = useState<readonly ArchivePost[]>(
    EMPTY_POSTS,
  );
  const [remoteCalendarPosts, setRemoteCalendarPosts] = useState<
    readonly ArchivePost[]
  >(EMPTY_POSTS);
  const [remoteCalendarPostsKey, setRemoteCalendarPostsKey] = useState<
    string | null
  >(null);
  const [membersState, setMembersState] = useState<LoadState>(() =>
    createInitialLoadState(archiveLoader !== undefined),
  );
  const [archiveState, setArchiveState] = useState<LoadState>(() =>
    createInitialLoadState(archiveLoader !== undefined),
  );
  const [reloadVersion, setReloadVersion] = useState(0);
  const membersRequestId = useRef(0);
  const archiveRequestId = useRef(0);

  const membersRequestKey = createMembersRequestKey(
    currentGroup.id,
    reloadVersion,
  );
  const archiveRequestKey = createArchiveRequestKey(
    currentGroup.id,
    selectedDateKey,
    selectedMemberId,
    reloadVersion,
  );
  const calendarRequestKey = createCalendarRequestKey(
    currentGroup.id,
    selectedMemberId,
  );

  const members =
    archiveLoader === undefined
      ? initialMembers ??
        (__DEV__ ? DEVELOPMENT_ARCHIVE_MEMBERS : EMPTY_MEMBERS)
      : membersState.key === membersRequestKey &&
          membersState.status === 'success'
        ? remoteMembers
        : EMPTY_MEMBERS;
  const posts =
    archiveLoader === undefined
      ? initialPosts ?? (__DEV__ ? DEVELOPMENT_ARCHIVE_POSTS : EMPTY_POSTS)
      : archiveState.key === archiveRequestKey &&
          archiveState.status === 'success'
        ? remotePosts
        : EMPTY_POSTS;
  const calendarPosts =
    archiveLoader === undefined || remoteCalendarPostsKey === calendarRequestKey
      ? archiveLoader === undefined
        ? posts
        : remoteCalendarPosts
      : EMPTY_POSTS;

  useEffect(() => {
    setSelectedMemberId(null);
    setSelectedDateKey(null);
    setIsCalendarOpen(false);
  }, [currentGroup.id]);

  useEffect(() => {
    if (archiveLoader === undefined || membersLoader === undefined) {
      setMembersState({key: membersRequestKey, status: 'success'});
      return;
    }

    const requestId = membersRequestId.current + 1;
    const requestKey = membersRequestKey;
    membersRequestId.current = requestId;
    setMembersState({key: requestKey, status: 'loading'});
    void membersLoader(currentGroup.id)
      .then(result => {
        if (membersRequestId.current !== requestId) {
          return;
        }
        setRemoteMembers(result);
        setMembersState({key: requestKey, status: 'success'});
      })
      .catch(error => {
        if (membersRequestId.current !== requestId) {
          return;
        }
        setMembersState({
          key: requestKey,
          message:
            error instanceof Error
              ? error.message
              : '구성원 목록을 불러오지 못했습니다.',
          status: 'error',
        });
      });
  }, [
    archiveLoader,
    currentGroup.id,
    membersLoader,
    membersRequestKey,
    reloadVersion,
  ]);

  useEffect(() => {
    if (archiveLoader === undefined) {
      setArchiveState({key: archiveRequestKey, status: 'success'});
      return;
    }

    const requestId = archiveRequestId.current + 1;
    archiveRequestId.current = requestId;
    setRemotePosts(EMPTY_POSTS);
    if (selectedDateKey === null) {
      setRemoteCalendarPosts(EMPTY_POSTS);
      setRemoteCalendarPostsKey(null);
    }
    setArchiveState({key: archiveRequestKey, status: 'loading'});
    void archiveLoader(currentGroup.id, {
      date: selectedDateKey,
      memberId: selectedMemberId,
    })
      .then(result => {
        if (archiveRequestId.current !== requestId) {
          return;
        }
        setRemotePosts(result);
        if (selectedDateKey === null) {
          setRemoteCalendarPosts(result);
          setRemoteCalendarPostsKey(calendarRequestKey);
        }
        setArchiveState({key: archiveRequestKey, status: 'success'});
      })
      .catch(error => {
        if (archiveRequestId.current !== requestId) {
          return;
        }
        setArchiveState({
          key: archiveRequestKey,
          message:
            error instanceof Error
              ? error.message
              : '보관함을 불러오지 못했습니다.',
          status: 'error',
        });
      });
  }, [
    archiveLoader,
    archiveRequestKey,
    currentGroup.id,
    calendarRequestKey,
    reloadVersion,
    selectedDateKey,
    selectedMemberId,
  ]);

  // 렌더마다 새 객체가 되어 달력 모달의 표시 월을 초기화시키지 않도록 안정화한다.
  const initialMonth = useMemo(() => computeInitialMonth(posts), [posts]);

  const visiblePosts = filterPosts(posts, {
    dateKey: selectedDateKey,
    memberId: selectedMemberId,
  });
  const groups = groupPostsByDate(visiblePosts);
  const isEmpty = visiblePosts.length === 0;
  const errorMessage =
    membersState.key === membersRequestKey && membersState.status === 'error'
      ? membersState.message
      : archiveState.key === archiveRequestKey && archiveState.status === 'error'
        ? archiveState.message
        : null;
  const isLoading =
    archiveLoader !== undefined &&
    ((membersState.key !== membersRequestKey ||
      membersState.status === 'loading') ||
      (archiveState.key !== archiveRequestKey ||
        archiveState.status === 'loading'));

  const handleSelectMember = (memberId: MemberFilter) => {
    setSelectedMemberId(memberId);
    // 구성원을 바꾸면 이전 날짜 필터는 적용 대상이 달라지므로 초기화한다.
    setSelectedDateKey(null);
  };

  const handleSelectDate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    setIsCalendarOpen(false);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <BackButton
          accessibilityLabel="피드로 돌아가기"
          onPress={onCloseArchive}
        />
        <Text style={styles.title}>보관함</Text>
        <Pressable
          accessibilityHint="날짜별로 게시글을 찾습니다"
          accessibilityLabel="날짜로 찾기"
          accessibilityRole="button"
          onPress={() => setIsCalendarOpen(true)}
          style={styles.calendarButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="calendar-blank-outline"
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <ArchiveMemberFilter
          members={members}
          onSelect={handleSelectMember}
          selectedMemberId={selectedMemberId}
        />
      </View>

      {selectedDateKey ? (
        <View style={styles.dateFilterRow}>
          <Pressable
            accessibilityHint="날짜 필터를 해제하고 전체 날짜를 봅니다"
            accessibilityLabel={`날짜 필터 ${formatDateLabel(
              selectedDateKey,
            )} 해제`}
            accessibilityRole="button"
            onPress={() => setSelectedDateKey(null)}
            style={styles.dateFilterChip}
          >
            <Text style={styles.dateFilterText}>
              {formatDateLabel(selectedDateKey)}
            </Text>
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="close"
              size={16}
            />
          </Pressable>
        </View>
      ) : null}

      {errorMessage ? (
        <ArchiveErrorState
          message={errorMessage}
          onRetry={() => setReloadVersion(version => version + 1)}
        />
      ) : isLoading ? (
        <ActivityIndicator
          accessibilityLabel="보관함을 불러오는 중"
          color={COLORS.purple}
          style={styles.loading}
        />
      ) : isEmpty ? (
        <ArchiveEmptyState
          memberName={
            members.find(member => member.id === selectedMemberId)?.name ?? null
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {groups.map(group => (
            <ArchiveDateSection
              group={group}
              key={group.dateKey}
              onOpenPost={post => onOpenPost?.(post.postId, post.groupId)}
            />
          ))}
        </ScrollView>
      )}

      <ArchiveCalendarModal
        initialMonth={initialMonth}
        memberId={selectedMemberId}
        onClose={() => setIsCalendarOpen(false)}
        onSelectDate={handleSelectDate}
        posts={calendarPosts}
        visible={isCalendarOpen}
      />
    </View>
  );
}

type LoadState =
  | {key: string | null; status: 'error'; message: string}
  | {key: string | null; status: 'loading'}
  | {key: string | null; status: 'success'};

function createInitialLoadState(isRemote: boolean): LoadState {
  if (isRemote) {
    return {key: null, status: 'loading'};
  }
  return {key: null, status: 'success'};
}

function createMembersRequestKey(groupId: string, reloadVersion: number) {
  return `${groupId}|${reloadVersion}`;
}

function createArchiveRequestKey(
  groupId: string,
  date: string | null,
  memberId: MemberFilter,
  reloadVersion: number,
) {
  return `${groupId}|${date ?? ''}|${memberId ?? ''}|${reloadVersion}`;
}

function createCalendarRequestKey(
  groupId: string,
  memberId: MemberFilter,
) {
  return `${groupId}|${memberId ?? ''}`;
}

function ArchiveErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorState}>
      <Text style={styles.errorText}>{message}</Text>
      <RetryButton accessibilityLabel="보관함 다시 시도" onPress={onRetry} />
    </View>
  );
}

function ArchiveEmptyState({memberName}: {memberName: string | null}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MaterialDesignIcons
          color={COLORS.purpleDeep}
          name="folder-open-outline"
          size={30}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {memberName
          ? `${memberName}님이 작성한 게시글이 없어요`
          : '아직 보관된 게시글이 없어요'}
      </Text>
      <Text style={styles.emptyDescription}>
        가족이 새로운 이야기를 올리면{'\n'}여기에서 모아 볼 수 있어요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dateFilterChip: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 14,
  },
  dateFilterRow: {
    alignItems: 'flex-start',
    paddingBottom: 4,
    paddingHorizontal: 20,
  },
  dateFilterText: {
    color: COLORS.purpleDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 80,
    paddingHorizontal: 24,
  },
  errorState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyTitle: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 18,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 60,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  listContent: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  loading: {
    flex: 1,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  title: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  toolbar: {
    alignItems: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 2,
  },
});
