import {ScrollView, StyleSheet} from 'react-native';

import {DraggableBottomSheet} from '../../../shared/components/DraggableBottomSheet';
import {useKeyboardVisible} from '../../../shared/hooks/useKeyboardVisible';
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
  const keyboardVisible = useKeyboardVisible();

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
      <ScrollView
        contentContainerStyle={[
          styles.content,
          keyboardVisible && styles.contentWithKeyboard,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
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
    overflow: 'hidden',
  },
  // 가입·생성 플로우는 단계마다 높이가 튀지 않도록 콘텐츠에 하한을 둔다.
  // 시트가 아닌 콘텐츠에 두어야 작은 화면에서 넘치지 않고 스크롤된다.
  // 349 = 기존 시트 하한 439 - 핸들 42 - 내비게이션 바 인셋 48.
  content: {
    flexGrow: 1,
    minHeight: 349,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
  // 키보드가 올라오면 쓸 수 있는 높이가 하한보다 작아진다. 하한을 그대로 두면
  // 콘텐츠가 시트보다 길어져 맨 아래 제출 버튼이 접힌 아래로 밀려 잘린다.
  contentWithKeyboard: {
    minHeight: 0,
  },
});
