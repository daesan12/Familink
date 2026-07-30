import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
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
  initialMembers?: readonly ArchiveMember[];
  initialPosts?: readonly ArchivePost[];
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
  initialMembers,
  initialPosts,
  onCloseArchive,
  onOpenPost,
}: ArchiveScreenProps) {
  const members =
    initialMembers ?? (__DEV__ ? DEVELOPMENT_ARCHIVE_MEMBERS : EMPTY_MEMBERS);
  const posts =
    initialPosts ?? (__DEV__ ? DEVELOPMENT_ARCHIVE_POSTS : EMPTY_POSTS);

  const [selectedMemberId, setSelectedMemberId] = useState<MemberFilter>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // 렌더마다 새 객체가 되어 달력 모달의 표시 월을 초기화시키지 않도록 안정화한다.
  const initialMonth = useMemo(() => computeInitialMonth(posts), [posts]);

  const visiblePosts = filterPosts(posts, {
    dateKey: selectedDateKey,
    memberId: selectedMemberId,
  });
  const groups = groupPostsByDate(visiblePosts);
  const isEmpty = visiblePosts.length === 0;

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
        <Pressable
          accessibilityLabel="피드로 돌아가기"
          accessibilityRole="button"
          onPress={onCloseArchive}
          style={styles.backButton}
        >
          <MaterialDesignIcons
            color={COLORS.background}
            name="chevron-left"
            size={24}
          />
        </Pressable>
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

      {isEmpty ? (
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
        posts={posts}
        visible={isCalendarOpen}
      />
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
  backButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavender,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
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
