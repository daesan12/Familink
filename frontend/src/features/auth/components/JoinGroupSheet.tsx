import {useEffect, useState} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {AUTH_COLORS} from '../theme';
import {GroupBottomSheet} from './GroupBottomSheet';
import {PrimaryButton} from './PrimaryButton';

interface JoinGroupSheetProps {
  onDismiss: () => void;
  onSubmit: (inviteCode: string) => Promise<void> | void;
  visible: boolean;
}

const INVITE_CODE_LENGTH = 6;
const JOIN_REQUEST_ERROR_MESSAGE =
  '초대 코드를 확인하고 다시 시도해주세요.';

export function JoinGroupSheet({
  onDismiss,
  onSubmit,
  visible,
}: JoinGroupSheetProps) {
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    setInviteCode('');
    setIsSubmitting(false);
    setSubmitError(null);
  }, [visible]);

  const handleChangeText = (value: string) => {
    setSubmitError(null);
    setInviteCode(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, INVITE_CODE_LENGTH),
    );
  };

  const handleSubmit = async () => {
    if (
      inviteCode.length !== INVITE_CODE_LENGTH ||
      isSubmitting
    ) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(inviteCode);
      onDismiss();
    } catch {
      setSubmitError(JOIN_REQUEST_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GroupBottomSheet
      accessibilityLabel="초대 코드로 참여"
      onDismiss={onDismiss}
      visible={visible}>
      <Text style={styles.title}>초대 코드로 참여</Text>
      <Text style={styles.description}>
        가족에게 받은 6자리 코드를 입력해주세요
      </Text>

      <View style={styles.codeInputArea}>
        <View pointerEvents="none" style={styles.codeRow}>
          {Array.from({length: INVITE_CODE_LENGTH}, (_, index) => {
            const character = inviteCode[index] ?? '';
            const filled = character.length > 0;
            const active =
              inviteCode.length === index ||
              (inviteCode.length === INVITE_CODE_LENGTH &&
                index === INVITE_CODE_LENGTH - 1);

            return (
              <View
                key={`invite-code-${index}`}
                style={[
                  styles.codeCell,
                  filled && styles.filledCodeCell,
                  active && styles.activeCodeCell,
                  submitError !== null && styles.errorCodeCell,
                ]}
                testID={`invite-code-cell-${index}`}>
                <Text style={styles.codeCharacter}>{character}</Text>
              </View>
            );
          })}
        </View>

        <TextInput
          accessibilityLabel="6자리 초대 코드"
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          caretHidden
          editable={!isSubmitting}
          keyboardType="visible-password"
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          selectionColor="transparent"
          style={styles.codeInput}
          value={inviteCode}
        />
      </View>

      <View style={styles.feedback}>
        {submitError !== null && (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.errorText}>
            {submitError}
          </Text>
        )}
      </View>

      <View style={styles.submit}>
        <PrimaryButton
          disabled={inviteCode.length !== INVITE_CODE_LENGTH}
          label="참여 요청 보내기"
          loading={isSubmitting}
          onPress={handleSubmit}
          tone="lavender"
        />
      </View>
    </GroupBottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    color: AUTH_COLORS.body,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  description: {
    color: '#6B6E80',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
  },
  codeInputArea: {
    marginTop: 36,
    position: 'relative',
    width: '100%',
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  codeCell: {
    alignItems: 'center',
    backgroundColor: AUTH_COLORS.surface,
    borderColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 3,
    height: 62,
    justifyContent: 'center',
    width: 50,
  },
  activeCodeCell: {
    borderColor: AUTH_COLORS.primarySoft,
  },
  filledCodeCell: {
    backgroundColor: AUTH_COLORS.primarySoft,
    borderColor: AUTH_COLORS.primarySoft,
  },
  errorCodeCell: {
    borderColor: AUTH_COLORS.error,
  },
  codeCharacter: {
    color: '#13141C',
    fontSize: 23,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  codeInput: {
    backgroundColor: 'transparent',
    bottom: 0,
    color: 'transparent',
    fontSize: 1,
    left: 0,
    opacity: 0.01,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  feedback: {
    minHeight: 20,
    marginTop: 10,
  },
  errorText: {
    color: AUTH_COLORS.error,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  submit: {
    marginTop: 54,
  },
});
