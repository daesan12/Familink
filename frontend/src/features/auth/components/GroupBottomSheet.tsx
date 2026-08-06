import {KeyboardAvoidingView, ScrollView, StyleSheet} from 'react-native';

import {DraggableBottomSheet} from '../../../shared/components/DraggableBottomSheet';
import {AUTH_COLORS} from '../theme';

interface GroupBottomSheetProps {
  accessibilityLabel: string;
  children: React.ReactNode;
  dismissDisabled?: boolean;
  onDismiss: () => void;
  visible: boolean;
}

export function GroupBottomSheet({
  accessibilityLabel,
  children,
  dismissDisabled = false,
  onDismiss,
  visible,
}: GroupBottomSheetProps) {
  const handleDismiss = () => {
    if (!dismissDisabled) {
      onDismiss();
    }
  };

  return (
    <DraggableBottomSheet
      accessibilityLabel={accessibilityLabel}
      backdropVisible={true}
      dismissDisabled={dismissDisabled}
      onClose={handleDismiss}
      sheetStyle={styles.sheet}
      visible={visible}
    >
      <KeyboardAvoidingView behavior="padding">
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </DraggableBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: AUTH_COLORS.background,
    borderCurve: 'continuous',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    boxShadow: '0px -10px 28px rgba(15, 23, 42, 0.12)',
    maxHeight: '72%',
    minHeight: 439,
    overflow: 'hidden',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
});
