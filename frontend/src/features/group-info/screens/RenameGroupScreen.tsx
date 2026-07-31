import {useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {SubScreenHeader} from '../components/SubScreenHeader';
import {
  GROUP_NAME_MAX_LENGTH,
  clampGroupNameInput,
  isGroupNameSaveable,
} from '../groupManagementModel';

interface RenameGroupScreenProps {
  currentName: string;
  onBack: () => void;
  // 그룹명 변경 확정 콜백. 다듬은 새 이름을 넘긴다(연동은 후속).
  onRenameGroup?: (name: string) => void;
}

// H-10 그룹명 변경. 1~10자이며 기존과 다른 이름으로 바꿀 때만 변경할 수 있다.
export function RenameGroupScreen({
  currentName,
  onBack,
  onRenameGroup,
}: RenameGroupScreenProps) {
  const [draft, setDraft] = useState(currentName);
  const canSubmit = isGroupNameSaveable(draft, currentName);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    onRenameGroup?.(draft.trim());
    onBack();
  };

  return (
    <View style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="그룹명 변경" />

      <View style={styles.content}>
        <Text style={styles.heading}>그룹 이름을 변경하세요</Text>
        <Text style={styles.subtitle}>언제든지 자유롭게 변경 가능합니다.</Text>

        <TextInput
          accessibilityLabel="그룹 이름 입력"
          maxLength={GROUP_NAME_MAX_LENGTH}
          onChangeText={(value) => setDraft(clampGroupNameInput(value))}
          placeholder="그룹 이름"
          placeholderTextColor={COLORS.textSubtle}
          style={styles.input}
          value={draft}
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityLabel="변경하기"
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit}}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
        >
          <Text style={styles.submitButtonText}>변경하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  footer: {
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
  input: {
    borderColor: COLORS.border,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    color: COLORS.textStrong,
    fontSize: 16,
    marginTop: 16,
    minHeight: 56,
    paddingHorizontal: 18,
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
  subtitle: {
    color: COLORS.textSubtle,
    fontSize: 14,
    lineHeight: 20,
  },
});
