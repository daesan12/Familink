import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {NoticeBanner} from '../../../shared/components/NoticeBanner';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {GroupMemberAvatar} from '../components/GroupMemberAvatar';
import {
  currentManagerId,
  isManagerChangeSaveable,
} from '../groupManagementModel';
import {getGroupManagementErrorMessage} from '../api/groupManagementApi';
import type {GroupMember} from '../types';

interface ChangeManagerScreenProps {
  members: readonly GroupMember[];
  // 조회자(현재 관리자) memberId. 본인 행에는 "나"를 표시한다.
  currentMemberId: string;
  onBack: () => void;
  // 변경 확정 콜백. API 성공 후에만 화면이 닫힌다.
  onChangeManager?: (memberId: string) => unknown;
}

const CONFIRM_NOTES: readonly string[] = [
  '그룹 코드와 가입 승인을 새 그룹관리자가 관리해요.',
  '가족 기록과 구성원 정보는 그대로 유지돼요.',
];

// H-6 그룹관리자 변경. 활성 구성원 중 한 명을 새 관리자로 선택해 위임한다.
// 관리자 여부는 구성원 역할과 독립이므로 피보호자도 후보다. 현재 관리자만 선택할 수 없다.
export function ChangeManagerScreen({
  members,
  currentMemberId,
  onBack,
  onChangeManager,
}: ChangeManagerScreenProps) {
  const managerId = currentManagerId(members);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSubmit = isManagerChangeSaveable(members, selectedId);

  const handleSubmit = () => {
    if (!selectedId || !canSubmit || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    try {
      const result = onChangeManager?.(selectedId);
      if (result !== undefined && isPromiseLike(result)) {
        setIsSubmitting(true);
        result
          .then(onBack)
          .catch((error: unknown) => {
            setErrorMessage(
              getGroupManagementErrorMessage(
                error,
                '관리자 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.',
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
          '관리자 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="그룹관리자 변경" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.heading}>새 그룹관리자를 선택하세요</AppText>
        <AppText style={styles.subtitle}>
          변경 후에는 새 그룹관리자만 그룹을 관리할 수 있어요.
        </AppText>

        <View style={styles.list}>
          {members.map((member) => {
            const isCurrentManager = member.memberId === managerId;
            const isSelected = member.memberId === selectedId;
            const subtitle =
              member.memberId === currentMemberId
                ? '나'
                : (member.alias ?? '');

            return (
              <Pressable
                accessibilityLabel={`${member.name} 선택`}
                accessibilityRole="radio"
                accessibilityState={{
                  disabled: isCurrentManager,
                  selected: isSelected,
                }}
                disabled={isCurrentManager}
                key={member.memberId}
                onPress={() => setSelectedId(member.memberId)}
                style={[styles.row, isSelected && styles.rowSelected]}
              >
                <GroupMemberAvatar member={member} />
                <View style={styles.rowText}>
                  <AppText style={styles.name}>{member.name}</AppText>
                  {subtitle ? (
                    <AppText style={styles.relation}>{subtitle}</AppText>
                  ) : null}
                </View>
                {isCurrentManager ? (
                  <AppText style={styles.currentTag}>현재 그룹관리자</AppText>
                ) : null}
                <MaterialDesignIcons
                  color={isSelected ? COLORS.purple : COLORS.inactive}
                  name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={24}
                />
              </Pressable>
            );
          })}
        </View>

        <View style={styles.noticeCard}>
          <AppText style={styles.noticeTitle}>변경 전에 확인해 주세요</AppText>
          {CONFIRM_NOTES.map((note) => (
            <AppText key={note} style={styles.noticeBody}>
              • {note}
            </AppText>
          ))}
        </View>
        {errorMessage ? <NoticeBanner message={errorMessage} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="그룹관리자 변경하기"
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit || isSubmitting}}
          disabled={!canSubmit || isSubmitting}
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            (!canSubmit || isSubmitting) && styles.submitButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <AppText
              style={[
                styles.submitButtonText,
                !canSubmit && styles.submitButtonTextDisabled,
              ]}
            >
              그룹관리자 변경하기
            </AppText>
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
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  currentTag: {
    color: COLORS.textSubtle,
    fontSize: 13,
  },
  footer: {
    borderTopColor: COLORS.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  heading: {
    color: COLORS.textStrong,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  list: {
    gap: 12,
    marginTop: 8,
  },
  name: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  noticeBody: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    gap: 8,
    marginTop: 8,
    padding: 20,
  },
  noticeTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  relation: {
    color: COLORS.textSubtle,
    fontSize: 13,
    marginTop: 2,
  },
  row: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 16,
  },
  rowSelected: {
    borderColor: COLORS.purple,
    borderWidth: 2,
  },
  rowText: {
    flex: 1,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: COLORS.purpleDeep,
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
  submitButtonTextDisabled: {
    color: COLORS.background,
  },
  subtitle: {
    color: COLORS.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
});
