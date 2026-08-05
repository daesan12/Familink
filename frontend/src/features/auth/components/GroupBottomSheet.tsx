import {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(reduceMotion ? 0 : 32);

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: reduceMotion ? 120 : 200,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        duration: reduceMotion ? 0 : 240,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    backdropOpacity,
    reduceMotion,
    sheetTranslateY,
    visible,
  ]);

  if (!visible) {
    return null;
  }

  const handleDismiss = () => {
    if (!dismissDisabled) {
      onDismiss();
    }
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={handleDismiss}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}>
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityViewIsModal
        style={styles.modal}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityElementsHidden
          disabled={dismissDisabled}
          importantForAccessibility="no-hide-descendants"
          onPress={handleDismiss}
          style={StyleSheet.absoluteFill}
        />
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={styles.keyboardArea}>
          <Animated.View
            style={[
              styles.sheet,
              {transform: [{translateY: sheetTranslateY}]},
            ]}>
            <View accessibilityElementsHidden style={styles.handle} />
            <ScrollView
              contentContainerStyle={[
                styles.content,
                {paddingBottom: Math.max(insets.bottom, 24)},
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              {children}
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(13, 15, 26, 0.38)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
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
  handle: {
    alignSelf: 'center',
    backgroundColor: '#ADB0BD',
    borderCurve: 'continuous',
    borderRadius: 3,
    height: 5,
    marginTop: 16,
    width: 46,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 30,
  },
});
