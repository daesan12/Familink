import {useEffect, useRef, useState} from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {AUTH_COLORS} from '../theme';
import {AnimatedPressable} from './AnimatedPressable';
import {GroupBottomSheet} from './GroupBottomSheet';
import {PrimaryButton} from './PrimaryButton';

interface JoinGroupSheetProps {
  onDismiss: () => void;
  onSubmit: (inviteCode: string) => void;
  visible: boolean;
}

const INVITE_CODE_LENGTH = 6;

export function JoinGroupSheet({
  onDismiss,
  onSubmit,
  visible,
}: JoinGroupSheetProps) {
  const inputRef = useRef<TextInput>(null);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    setInviteCode('');
  }, [visible]);

  const handleChangeText = (value: string) => {
    setInviteCode(
      value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, INVITE_CODE_LENGTH),
    );
  };

  const handleSubmit = () => {
    if (inviteCode.length !== INVITE_CODE_LENGTH) {
      return;
    }

    onSubmit(inviteCode);
    onDismiss();
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

      <AnimatedPressable
        accessibilityLabel="초대 코드 입력칸 열기"
        accessibilityRole="button"
        containerStyle={styles.codeButton}
        onPress={() => inputRef.current?.focus()}>
        <View pointerEvents="none" style={styles.codeRow}>
          {Array.from({length: INVITE_CODE_LENGTH}, (_, index) => {
            const character = inviteCode[index] ?? '';
            const active =
              inviteCode.length === index ||
              (inviteCode.length === INVITE_CODE_LENGTH &&
                index === INVITE_CODE_LENGTH - 1);

            return (
              <View
                key={`invite-code-${index}`}
                style={[styles.codeCell, active && styles.activeCodeCell]}>
                <Text style={styles.codeCharacter}>{character}</Text>
              </View>
            );
          })}
        </View>
      </AnimatedPressable>

      <TextInput
        accessibilityLabel="6자리 초대 코드"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        caretHidden
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        ref={inputRef}
        returnKeyType="done"
        style={styles.hiddenInput}
        value={inviteCode}
      />

      <View style={styles.submit}>
        <PrimaryButton
          disabled={inviteCode.length !== INVITE_CODE_LENGTH}
          label="참여 요청 보내기"
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
  codeButton: {
    marginTop: 36,
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
  codeCharacter: {
    color: '#13141C',
    fontSize: 23,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  hiddenInput: {
    height: 1,
    opacity: 0.01,
    position: 'absolute',
    width: 1,
  },
  submit: {
    marginTop: 84,
  },
});
