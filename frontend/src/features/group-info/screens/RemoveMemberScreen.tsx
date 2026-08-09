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
import {getGroupManagementErrorMessage} from '../api/groupManagementApi';
import {formatJoinedDate, removableMembers} from '../groupManagementModel';
import type {GroupMember} from '../types';

interface RemoveMemberScreenProps {
  members: readonly GroupMember[];
  // 조회자(본인). 본인은 내보낼 수 없어 선택 목록에서 제외한다.
  currentMemberId: string;
  onBack: () => void;
  // 내보내기 확정 콜백. API 성공 후에만 그룹정보로 돌아간다.
  onRemoveMember?: (memberId: string) => unknown;
}

const REMOVE_NOTES: readonly string[] = [
  '이 그룹의 가족 기록을 더 이상 볼 수 없어요.',
  '그룹에서 공유한 알림을 받지 못해요.',
  '본인이 작성한 기록은 그룹에 남아 있어요.',
];

// H-7 구성원 내보내기. 대상을 고르고(1단계) 확인 체크 후 내보낸다(2단계).
export function RemoveMemberScreen({
  members,
  currentMemberId,
  onBack,
  onRemoveMember,
}: RemoveMemberScreenProps) {
  const candidates = removableMembers(members, currentMemberId);
  // 선택한 구성원. null이면 1단계(선택), 있으면 2단계(확인).
  const [selected, setSelected] = useState<GroupMember | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 2단계에서 뒤로가면 1단계로, 1단계에서 뒤로가면 그룹정보로 돌아간다.
  const handleBack = () => {
    if (selected) {
      setSelected(null);
      setConfirmed(false);
      return;
    }
    onBack();
  };

  const handleRemove = () => {
    if (!selected || !confirmed || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    try {
      const result = onRemoveMember?.(selected.memberId);
      if (result !== undefined && isPromiseLike(result)) {
        setIsSubmitting(true);
        result
          .then(onBack)
          .catch((error: unknown) => {
            setErrorMessage(
              getGroupManagementErrorMessage(
                error,
                '구성원을 내보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
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
          '구성원을 내보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
    }
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={handleBack} title="구성원 내보내기" />

      {selected ? (
        <ConfirmStep
          confirmed={confirmed}
          member={selected}
          errorMessage={errorMessage}
          isSubmitting={isSubmitting}
          onRemove={handleRemove}
          onToggleConfirm={() => setConfirmed((value) => !value)}
        />
      ) : (
        <SelectStep candidates={candidates} onSelect={setSelected} />
      )}
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

// 1단계: 내보낼 수 있는 구성원 목록. 행을 누르면 확인 단계로 넘어간다.
function SelectStep({
  candidates,
  onSelect,
}: {
  candidates: readonly GroupMember[];
  onSelect: (member: GroupMember) => void;
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText style={styles.heading}>내보낼 구성원을 선택하세요</AppText>

      {candidates.length > 0 ? (
        <View style={styles.list}>
          {candidates.map((member) => (
            <Pressable
              accessibilityLabel={`${member.name} 내보내기 선택`}
              accessibilityRole="button"
              key={member.memberId}
              onPress={() => onSelect(member)}
              style={styles.row}
            >
              <GroupMemberAvatar member={member} />
              <View style={styles.rowText}>
                <AppText style={styles.name}>{member.name}</AppText>
                {member.alias ? (
                  <AppText style={styles.relation}>{member.alias}</AppText>
                ) : null}
              </View>
              <MaterialDesignIcons
                color={COLORS.textSubtle}
                name="chevron-right"
                size={22}
              />
            </Pressable>
          ))}
        </View>
      ) : (
        <AppText style={styles.emptyText}>내보낼 수 있는 구성원이 없어요.</AppText>
      )}
    </ScrollView>
  );
}

// 2단계: 선택한 구성원 정보와 안내를 확인하고 체크 후 내보낸다.
function ConfirmStep({
  member,
  confirmed,
  errorMessage,
  isSubmitting,
  onToggleConfirm,
  onRemove,
}: {
  member: GroupMember;
  confirmed: boolean;
  errorMessage: string | null;
  isSubmitting: boolean;
  onToggleConfirm: () => void;
  onRemove: () => void;
}) {
  const joined = formatJoinedDate(member.joinedAt);
  const cardSubtitle = [member.alias, joined].filter(Boolean).join(' · ');

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.heading}>내보낼 구성원</AppText>

        <View style={styles.memberCard}>
          <GroupMemberAvatar member={member} />
          <View style={styles.rowText}>
            <AppText style={styles.name}>{member.name}</AppText>
            {cardSubtitle ? (
              <AppText style={styles.relation}>{cardSubtitle}</AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.noticeCard}>
          <AppText style={styles.noticeTitle}>내보내면 이렇게 달라져요</AppText>
          {REMOVE_NOTES.map((note) => (
            <AppText key={note} style={styles.noticeBody}>
              • {note}
            </AppText>
          ))}
        </View>

        <Pressable
          accessibilityLabel="위 내용을 확인했으며 구성원을 내보냅니다"
          accessibilityRole="checkbox"
          accessibilityState={{checked: confirmed}}
          onPress={onToggleConfirm}
          style={styles.checkboxRow}
        >
          <MaterialDesignIcons
            color={confirmed ? COLORS.purple : COLORS.inactive}
            name={confirmed ? 'checkbox-marked' : 'checkbox-blank-outline'}
            size={22}
          />
          <AppText style={styles.checkboxLabel}>
            위 내용을 확인했으며 구성원을 내보냅니다.
          </AppText>
        </Pressable>
        {errorMessage ? <NoticeBanner message={errorMessage} /> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="구성원 내보내기"
          accessibilityRole="button"
          accessibilityState={{disabled: !confirmed || isSubmitting}}
          disabled={!confirmed || isSubmitting}
          onPress={onRemove}
          style={[
            styles.submitButton,
            (!confirmed || isSubmitting) && styles.submitButtonDisabled,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <AppText style={styles.submitButtonText}>구성원 내보내기</AppText>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  checkboxLabel: {
    color: COLORS.text,
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  checkboxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    paddingVertical: 4,
  },
  content: {
    gap: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  emptyText: {
    color: COLORS.textSubtle,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
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
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  list: {
    gap: 12,
  },
  memberCard: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    minHeight: 80,
    paddingHorizontal: 18,
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
});
