import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {
  currentManagerId,
  isManagerChangeSaveable,
  managerCandidates,
} from '../groupManagementModel';
import type {GroupMember} from '../types';

interface ChangeManagerScreenProps {
  members: readonly GroupMember[];
  // 조회자(현재 관리자) memberId. 본인 행에는 "나"를 표시한다.
  currentMemberId: string;
  onBack: () => void;
  // 변경 확정 콜백. 새 관리자 memberId를 넘긴다(연동은 후속).
  onChangeManager?: (memberId: string) => void;
}

const CONFIRM_NOTES: readonly string[] = [
  '그룹 코드와 가입 승인을 새 그룹관리자가 관리해요.',
  '가족 기록과 구성원 정보는 그대로 유지돼요.',
];

// H-6 그룹관리자 변경. 보호자 구성원 중 한 명을 새 관리자로 선택해 위임한다.
export function ChangeManagerScreen({
  members,
  currentMemberId,
  onBack,
  onChangeManager,
}: ChangeManagerScreenProps) {
  const candidates = managerCandidates(members);
  const managerId = currentManagerId(members);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canSubmit = isManagerChangeSaveable(members, selectedId);

  const handleSubmit = () => {
    if (!selectedId || !canSubmit) {
      return;
    }
    onChangeManager?.(selectedId);
    onBack();
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="그룹관리자 변경" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>새 그룹관리자를 선택하세요</Text>
        <Text style={styles.subtitle}>
          변경 후에는 새 그룹관리자만 그룹을 관리할 수 있어요.
        </Text>

        <View style={styles.list}>
          {candidates.map((member) => {
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
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{member.avatarText}</Text>
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{member.name}</Text>
                  {subtitle ? (
                    <Text style={styles.relation}>{subtitle}</Text>
                  ) : null}
                </View>
                {isCurrentManager ? (
                  <Text style={styles.currentTag}>현재 그룹관리자</Text>
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
          <Text style={styles.noticeTitle}>변경 전에 확인해 주세요</Text>
          {CONFIRM_NOTES.map((note) => (
            <Text key={note} style={styles.noticeBody}>
              • {note}
            </Text>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="그룹관리자 변경하기"
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit}}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        >
          <Text
            style={[
              styles.submitButtonText,
              !canSubmit && styles.submitButtonTextDisabled,
            ]}
          >
            그룹관리자 변경하기
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: RADII.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarText: {
    color: COLORS.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
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
    backgroundColor: COLORS.surfaceMuted,
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
  submitButtonTextDisabled: {
    color: COLORS.background,
  },
  subtitle: {
    color: COLORS.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
});
