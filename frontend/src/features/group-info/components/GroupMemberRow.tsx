import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, StyleSheet, Text, TextInput, View} from 'react-native';

import type {GroupRole} from '../../../app-shell';
import {COLORS, RADII} from '../../../design/tokens';
import {
  ALIAS_MAX_LENGTH,
  isAliasSaveable,
  resolveMemberDisplayName,
} from '../groupInfoModel';
import type {GroupMember} from '../types';
import {GroupMemberAvatar} from './GroupMemberAvatar';
import {RoleToggle} from './RoleToggle';

interface GroupMemberRowProps {
  member: GroupMember;
  // 이 행이 호칭 편집 모드인지.
  isEditing: boolean;
  // 편집 모드에서 입력 중인 호칭 초안.
  aliasDraft: string;
  onStartEditAlias: () => void;
  onChangeAliasDraft: (value: string) => void;
  onSaveAlias: () => void;
  // 저장하지 않고 편집 모드를 빠져나간다. 편집 중 숨긴 역할 토글을 복구하는 유일한 탈출구다.
  onCancelEditAlias: () => void;
  onSelectRole: (role: GroupRole) => void;
  onOpenProfile: () => void;
}

// H-1의 구성원 한 행. 호칭 표시/편집(H-2)과 역할 토글을 담는다.
export function GroupMemberRow({
  aliasDraft,
  isEditing,
  member,
  onCancelEditAlias,
  onChangeAliasDraft,
  onOpenProfile,
  onSaveAlias,
  onSelectRole,
  onStartEditAlias,
}: GroupMemberRowProps) {
  const displayName = resolveMemberDisplayName(member);
  const hasAlias = Boolean(member.alias && member.alias.trim());
  const canSave = isAliasSaveable(aliasDraft);
  const draftLength = Array.from(aliasDraft).length;

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`${member.name} 프로필 보기`}
        accessibilityRole="button"
        onPress={onOpenProfile}
      >
        <GroupMemberAvatar member={member} />
      </Pressable>

      <View style={styles.info}>
        {isEditing ? (
          <View style={styles.editLine}>
            <TextInput
              accessibilityLabel={`${member.name} 호칭 입력`}
              autoFocus
              maxLength={ALIAS_MAX_LENGTH}
              onChangeText={onChangeAliasDraft}
              onSubmitEditing={canSave ? onSaveAlias : undefined}
              placeholder="호칭 입력"
              placeholderTextColor={COLORS.textDisabled}
              style={styles.aliasInput}
              value={aliasDraft}
            />
            <Text style={styles.counter}>
              {draftLength}/{ALIAS_MAX_LENGTH}
            </Text>
            <Pressable
              accessibilityLabel={`${member.name} 호칭 저장`}
              accessibilityRole="button"
              accessibilityState={{disabled: !canSave}}
              disabled={!canSave}
              onPress={onSaveAlias}
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            >
              <Text style={styles.saveButtonText}>저장</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`${member.name} 호칭 편집 취소`}
              accessibilityRole="button"
              onPress={onCancelEditAlias}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelButtonText}>취소</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.nameLine}>
            <Text style={styles.displayName}>{displayName}</Text>
            <Pressable
              accessibilityLabel={`${member.name} 호칭 수정`}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onStartEditAlias}
              style={styles.editButton}
            >
              <MaterialDesignIcons
                color={COLORS.textSubtle}
                name="pencil-outline"
                size={16}
              />
            </Pressable>
          </View>
        )}

        {isEditing || hasAlias ? (
          <Text style={styles.realName}>{member.name}</Text>
        ) : null}
        {member.isManager ? (
          <View style={styles.managerTag}>
            <Text style={styles.managerTagText}>그룹관리자</Text>
          </View>
        ) : null}
      </View>

      {/* 편집 모드에서는 저장 버튼이 토글에 가려 오터치로 역할이 바뀌지 않도록 토글을 숨긴다. */}
      {isEditing ? null : (
        <RoleToggle
          memberName={member.name}
          onSelect={onSelectRole}
          role={member.role}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  aliasInput: {
    borderBottomColor: COLORS.purpleDeep,
    borderBottomWidth: 1.5,
    color: COLORS.textStrong,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    minWidth: 90,
    paddingVertical: 2,
  },
  cancelButton: {
    alignItems: 'center',
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 10,
  },
  cancelButtonText: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  counter: {
    color: COLORS.textSubtle,
    fontSize: 11,
  },
  displayName: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  editButton: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  editLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  managerTag: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  managerTagText: {
    color: COLORS.purpleDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  nameLine: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  realName: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
  },
  saveButton: {
    alignItems: 'center',
    backgroundColor: COLORS.purpleDeep,
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: 12,
  },
  saveButtonDisabled: {
    backgroundColor: COLORS.inactive,
  },
  saveButtonText: {
    color: COLORS.background,
    fontSize: 13,
    fontWeight: '700',
  },
});
