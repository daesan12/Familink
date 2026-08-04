import {useRef, useState} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
  // 그룹명 변경 확정 콜백. API 성공 후에만 화면을 닫는다.
  onRenameGroup?: (name: string) => Promise<void> | void;
}

// H-10 그룹명 변경. 1~10자이며 기존과 다른 이름으로 바꿀 때만 변경할 수 있다.
export function RenameGroupScreen({
  currentName,
  onBack,
  onRenameGroup,
}: RenameGroupScreenProps) {
  const [draft, setDraft] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const canSubmit = !submitting && isGroupNameSaveable(draft, currentName);

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onRenameGroup?.(draft.trim());
      onBack();
    } catch {
      Alert.alert(
        '그룹 이름을 바꾸지 못했어요',
        '네트워크 연결과 그룹 관리 권한을 확인해 주세요.',
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.screen}>
      <SubScreenHeader onBack={onBack} title="그룹명 변경" />

      <View style={styles.content}>
        <Text style={styles.heading}>그룹 이름을 변경하세요</Text>
        <Text style={styles.subtitle}>언제든지 자유롭게 변경 가능합니다.</Text>

        <TextInput
          accessibilityLabel="그룹 이름 입력"
          maxLength={GROUP_NAME_MAX_LENGTH}
          onChangeText={value => setDraft(clampGroupNameInput(value))}
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
          accessibilityState={{busy: submitting, disabled: !canSubmit}}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={[
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
          ]}>
          <Text style={styles.submitButtonText}>변경하기</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
