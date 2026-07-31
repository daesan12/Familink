import {useEffect, useRef, useState} from 'react';
import {Alert, StyleSheet, Text, TextInput, View} from 'react-native';

import {AUTH_COLORS} from '../theme';
import {AnimatedPressable} from './AnimatedPressable';
import {GroupBottomSheet} from './GroupBottomSheet';
import {PrimaryButton} from './PrimaryButton';

export type GroupRole = 'careReceiver' | 'guardian';

export interface CreateGroupInput {
  name: string;
  role: GroupRole;
}

interface CreateGroupSheetProps {
  onDismiss: () => void;
  onSubmit: (input: CreateGroupInput) => Promise<void> | void;
  visible: boolean;
}

const GROUP_NAME_MAX_LENGTH = 10;

export function CreateGroupSheet({
  onDismiss,
  onSubmit,
  visible,
}: CreateGroupSheetProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<GroupRole>('guardian');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const normalizedName = name.trim();

  useEffect(() => {
    if (!visible) {
      return;
    }

    setName('');
    setRole('guardian');
    setSubmitting(false);
    submittingRef.current = false;
  }, [visible]);

  const handleSubmit = async () => {
    if (normalizedName.length === 0 || submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onSubmit({name: normalizedName, role});
      onDismiss();
    } catch {
      Alert.alert('그룹을 만들지 못했어요', '잠시 후 다시 시도해 주세요.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <GroupBottomSheet
      accessibilityLabel="새 그룹 만들기"
      onDismiss={onDismiss}
      visible={visible}>
      <Text style={styles.title}>새 그룹 만들기</Text>

      <View style={styles.form}>
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>그룹 이름</Text>
          <TextInput
            accessibilityLabel="그룹 이름"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={GROUP_NAME_MAX_LENGTH}
            onChangeText={setName}
            placeholder="최대 10자까지 입력 가능합니다."
            placeholderTextColor="#ABADBA"
            returnKeyType="done"
            style={styles.input}
            value={name}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>내 역할</Text>
          <View
            accessibilityLabel="내 역할"
            accessibilityRole="radiogroup"
            style={styles.segmentedControl}>
            <RoleOption
              label="보호자"
              onPress={() => setRole('guardian')}
              selected={role === 'guardian'}
            />
            <RoleOption
              label="피보호자"
              onPress={() => setRole('careReceiver')}
              selected={role === 'careReceiver'}
            />
          </View>
        </View>
      </View>

      <View style={styles.submit}>
        <PrimaryButton
          disabled={normalizedName.length === 0 || submitting}
          label="생성하기"
          loading={submitting}
          onPress={handleSubmit}
          tone="lavender"
        />
      </View>
    </GroupBottomSheet>
  );
}

interface RoleOptionProps {
  label: string;
  onPress: () => void;
  selected: boolean;
}

function RoleOption({label, onPress, selected}: RoleOptionProps) {
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{checked: selected}}
      containerStyle={styles.roleOptionContainer}
      onPress={onPress}
      style={[styles.roleOptionPressable, selected && styles.selectedRole]}>
      <View style={styles.roleOption}>
        <Text style={[styles.roleLabel, selected && styles.selectedRoleLabel]}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: AUTH_COLORS.body,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 34,
    textAlign: 'center',
  },
  form: {
    gap: 22,
    marginTop: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: '#13151F',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  input: {
    backgroundColor: AUTH_COLORS.background,
    borderColor: '#E0E3ED',
    borderCurve: 'continuous',
    borderRadius: 12,
    borderWidth: 1,
    color: '#13151F',
    fontSize: 15,
    height: 46,
    paddingHorizontal: 16,
    paddingVertical: 0,
  },
  segmentedControl: {
    backgroundColor: AUTH_COLORS.background,
    borderColor: '#E0E3ED',
    borderCurve: 'continuous',
    borderRadius: 28,
    borderWidth: 1,
    flexDirection: 'row',
    height: 56,
    overflow: 'hidden',
    padding: 3,
  },
  roleOptionContainer: {
    borderRadius: 24,
    flex: 1,
    overflow: 'hidden',
  },
  roleOptionPressable: {
    borderRadius: 24,
    flex: 1,
    overflow: 'hidden',
  },
  roleOption: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  selectedRole: {
    backgroundColor: AUTH_COLORS.primarySoft,
  },
  roleLabel: {
    color: '#666B7D',
    fontSize: 15,
    fontWeight: '700',
  },
  selectedRoleLabel: {
    color: AUTH_COLORS.primaryDeep,
  },
  submit: {
    marginTop: 36,
  },
});
