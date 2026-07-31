import {useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {getGroupManagementErrorMessage} from '../api/groupManagementApi';

interface LeaveGroupScreenProps {
  groupName: string;
  memberCount: number;
  // 가족 기록 개수. 계약 밖 목업값이다(H-8 요약 카드).
  recordCount: number;
  managerName: string;
  // 조회자가 그룹관리자이면 먼저 위임해야 나갈 수 있어 나가기 버튼을 비활성화한다
  // (spec 규칙 10: 관리자는 다른 구성원이 있는 그룹에서 나가려면 먼저 위임한다).
  isViewerManager: boolean;
  onBack: () => void;
  // 그룹 나가기 확정 콜백. API 성공 후에만 화면이 닫힌다.
  onLeaveGroup?: () => unknown;
  // "그룹관리자 변경하기" 링크. H-6으로 이동한다.
  onGoToChangeManager: () => void;
}

// H-8 그룹 나가기. 그룹 요약과 관리자 위임 안내를 보여준 뒤 나가기를 확정한다.
export function LeaveGroupScreen({
  groupName,
  memberCount,
  recordCount,
  managerName,
  isViewerManager,
  onBack,
  onLeaveGroup,
  onGoToChangeManager,
}: LeaveGroupScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 관리자는 먼저 위임해야 나갈 수 있어 나가기를 막는다(버튼 disabled와 이중 방어).
  const handleLeave = () => {
    if (isViewerManager || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    try {
      const result = onLeaveGroup?.();
      if (result !== undefined && isPromiseLike(result)) {
        setIsSubmitting(true);
        result
          .then(onBack)
          .catch((error: unknown) => {
            setErrorMessage(
              getGroupManagementErrorMessage(
                error,
                '그룹을 나가지 못했습니다. 잠시 후 다시 시도해 주세요.',
              ),
            );
          })
          .finally(() => setIsSubmitting(false));
        return;
      }
      onBack();
    } catch (error) {
      setErrorMessage(
        getGroupManagementErrorMessage(
          error,
          '그룹을 나가지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="그룹 나가기" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>정말 그룹을 나가시겠어요?</Text>
        <Text style={styles.subtitle}>
          나가면 다시 초대받기 전까지 그룹을 볼 수 없어요.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.groupName}>{groupName}</Text>
          <Text style={styles.summaryLine}>
            구성원 {memberCount}명 · 가족 기록 {recordCount}개
          </Text>
          <Text style={styles.summaryLine}>그룹관리자 · {managerName}</Text>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>그룹관리자는 바로 나갈 수 없어요</Text>
          <Text style={styles.noticeBody}>
            먼저 다른 구성원에게 그룹관리자 역할을 넘긴 뒤 그룹을 나가 주세요.
          </Text>
          <Pressable
            accessibilityLabel="그룹관리자 변경하기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onGoToChangeManager}
            style={styles.noticeLink}
          >
            <Text style={styles.noticeLinkText}>그룹관리자 변경하기 ›</Text>
          </Pressable>
        </View>
        {errorMessage ? (
          <Text accessibilityRole="alert" style={styles.errorText}>
            {errorMessage}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="그룹 나가기"
          accessibilityRole="button"
          accessibilityState={{disabled: isViewerManager || isSubmitting}}
          disabled={isViewerManager || isSubmitting}
          onPress={handleLeave}
          style={[
            styles.submitButton,
            (isViewerManager || isSubmitting) && styles.submitButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.submitButtonText}>그룹 나가기</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
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
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  groupName: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
  },
  heading: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  noticeBody: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    gap: 10,
    padding: 20,
  },
  noticeLink: {
    alignSelf: 'flex-end',
  },
  noticeLinkText: {
    color: COLORS.textStrong,
    fontSize: 13,
    fontWeight: '700',
  },
  noticeTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: COLORS.textMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    justifyContent: 'center',
    minHeight: 56,
  },
  submitButtonDisabled: {
    backgroundColor: COLORS.inactive,
  },
  submitButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '700',
  },
  summaryCard: {
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  summaryLine: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  subtitle: {
    color: COLORS.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
});
