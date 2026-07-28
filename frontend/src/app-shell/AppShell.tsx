import { useEffect, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomTabBar } from './BottomTabBar';
import { CurrentGroupSwitcher } from './CurrentGroupSwitcher';
import {
  resolveAllowedRoute,
  resolveCurrentGroup,
} from './navigation';
import type {
  AppRoute,
  AppScreenRegistry,
  CurrentGroupStore,
  FamilyGroup,
} from './types';

interface AppShellProps {
  groupStore?: CurrentGroupStore;
  groups: readonly FamilyGroup[];
  initialGroupId?: string | null;
  initialRoute?: AppRoute;
  onCreateGroup?: () => void;
  onGroupChange?: (groupId: string) => void;
  onJoinGroup?: () => void;
  screens?: AppScreenRegistry;
}

export function AppShell({
  groupStore,
  groups,
  initialGroupId,
  initialRoute = 'feed',
  onCreateGroup,
  onGroupChange,
  onJoinGroup,
  screens = {},
}: AppShellProps) {
  const [activeRoute, setActiveRoute] = useState(initialRoute);
  const [currentGroupId, setCurrentGroupId] = useState(initialGroupId);
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);
  const [isRestoringGroup, setIsRestoringGroup] = useState(
    Boolean(groupStore && !initialGroupId),
  );

  const currentGroup = resolveCurrentGroup(groups, currentGroupId);
  const currentRole = currentGroup?.role;
  const resolvedRoute = currentRole
    ? resolveAllowedRoute(currentRole, activeRoute)
    : 'feed';

  useEffect(() => {
    if (!currentRole) {
      return;
    }

    setActiveRoute(currentRoute =>
      resolveAllowedRoute(currentRole, currentRoute),
    );
  }, [currentRole]);

  useEffect(() => {
    if (initialGroupId || !groupStore) {
      setIsRestoringGroup(false);
      return;
    }

    let isMounted = true;
    setIsRestoringGroup(true);

    groupStore
      .load()
      .then(savedGroupId => {
        if (isMounted && savedGroupId) {
          setCurrentGroupId(savedGroupId);
        }
      })
      .catch(() => {
        // 최근 그룹 복원 실패는 첫 사용 가능한 그룹으로 안전하게 대체한다.
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoringGroup(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [groupStore, initialGroupId]);

  if (isRestoringGroup) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text accessibilityRole="text" style={styles.emptyDescription}>
          최근 이용 그룹을 불러오고 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  if (!currentGroup) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>참여 중인 그룹이 없어요</Text>
        <Text style={styles.emptyDescription}>
          그룹을 만들거나 초대 코드로 가입을 요청해 주세요.
        </Text>
        <View style={styles.emptyActions}>
          <Pressable
            accessibilityRole="button"
            disabled={!onCreateGroup}
            onPress={onCreateGroup}
            style={[
              styles.primaryAction,
              !onCreateGroup && styles.disabledAction,
            ]}
          >
            <Text style={styles.primaryActionText}>그룹 만들기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!onJoinGroup}
            onPress={onJoinGroup}
            style={[
              styles.secondaryAction,
              !onJoinGroup && styles.disabledAction,
            ]}
          >
            <Text style={styles.secondaryActionText}>초대 코드 입력</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const Screen = screens[resolvedRoute];

  const handleGroupSelect = (groupId: string) => {
    setCurrentGroupId(groupId);
    setIsGroupMenuOpen(false);
    onGroupChange?.(groupId);
    void groupStore?.save(groupId).catch(() => {
      // 화면 전환은 유지하고 영속화 오류 처리는 상위 앱 계층에 위임한다.
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <CurrentGroupSwitcher
          currentGroup={currentGroup}
          groups={groups}
          isOpen={isGroupMenuOpen}
          onClose={() => setIsGroupMenuOpen(false)}
          onSelect={handleGroupSelect}
          onToggle={() => setIsGroupMenuOpen(isOpen => !isOpen)}
        />
      </View>

      <View style={styles.content}>
        {Screen ? (
          <Screen currentGroup={currentGroup} role={currentGroup.role} />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>
              {getPlaceholderTitle(resolvedRoute)}
            </Text>
            <Text style={styles.placeholderDescription}>
              담당 기능 화면이 연결될 예정입니다.
            </Text>
          </View>
        )}
      </View>

      <BottomTabBar
        activeRoute={resolvedRoute}
        onSelect={setActiveRoute}
        role={currentGroup.role}
      />
    </SafeAreaView>
  );
}

function getPlaceholderTitle(route: AppRoute): string {
  const titles: Record<AppRoute, string> = {
    aiCall: 'AI 전화',
    calendar: '일정',
    feed: '피드',
    groupInfo: '그룹정보',
    profile: '프로필',
    report: '리포트',
  };

  return titles[route];
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyDescription: {
    color: '#737373',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyActions: {
    marginTop: 24,
    width: '100%',
  },
  emptyTitle: {
    color: '#292929',
    fontSize: 20,
    fontWeight: '700',
  },
  disabledAction: {
    opacity: 0.45,
  },
  header: {
    alignItems: 'flex-start',
    borderBottomColor: '#E4E7EC',
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  placeholder: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  placeholderDescription: {
    color: '#8A8A8A',
    fontSize: 15,
    marginTop: 8,
  },
  placeholderTitle: {
    color: '#34312F',
    fontSize: 24,
    fontWeight: '700',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: '#6F6B68',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
    flex: 1,
  },
  secondaryAction: {
    alignItems: 'center',
    borderColor: '#D6D6D6',
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 10,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryActionText: {
    color: '#525252',
    fontSize: 16,
    fontWeight: '700',
  },
});
