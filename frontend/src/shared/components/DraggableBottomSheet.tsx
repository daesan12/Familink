import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {COLORS, RADII} from '../../design/tokens';

interface DraggableBottomSheetProps {
  accessibilityLabel: string;
  /** 바텀시트 뒤의 화면을 어둡게 할지 여부. 투명해도 바깥 터치 닫기는 유지한다. */
  backdropVisible?: boolean;
  children: React.ReactNode;
  dismissDisabled?: boolean;
  /** 처음 열릴 때 화면에 보일 높이. 설정하면 위로 끌어 펼칠 수 있다. */
  collapsedHeight?: number;
  initialSnap?: 'collapsed' | 'expanded';
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  visible: boolean;
}

/**
 * 공통 바텀시트. 핸들을 위아래로 드래그할 수 있고, 아래로 충분히 끌면 닫힌다.
 * 콘텐츠의 스크롤과 충돌하지 않도록 제스처는 핸들 영역에서만 시작한다.
 */
export function DraggableBottomSheet({
  accessibilityLabel,
  backdropVisible = true,
  children,
  collapsedHeight = 260,
  dismissDisabled = false,
  initialSnap = 'expanded',
  onClose,
  sheetStyle,
  visible,
}: DraggableBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(32)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [sheetHeight, setSheetHeight] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const currentSnapRef = useRef(0);
  const gestureStartRef = useRef(0);
  const wasVisibleRef = useRef(false);
  // 접힌 상태에서도 collapsedHeight만큼은 시스템 내비게이션 바 위로 보여야 한다.
  const collapsedOffset = Math.max(
    sheetHeight - collapsedHeight - insets.bottom,
    0,
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          gestureStartRef.current = currentSnapRef.current;
        },
        onPanResponderMove: (_, gesture) =>
          translateY.setValue(
            Math.max(0, gestureStartRef.current + gesture.dy),
          ),
        onPanResponderRelease: (_, gesture) => {
          if (dismissDisabled) {
            Animated.spring(translateY, {
              bounciness: 0,
              toValue: 0,
              useNativeDriver: true,
            }).start();
            currentSnapRef.current = 0;
            return;
          }
          if (gesture.dy > 90 || gesture.vy > 0.8) {
            Animated.timing(translateY, {
              duration: 160,
              toValue: 600,
              useNativeDriver: true,
            }).start(onClose);
            return;
          }
          const draggedTo = Math.max(
            0,
            gestureStartRef.current + gesture.dy,
          );
          const shouldExpand =
            gesture.dy < -24 ||
            (Math.abs(gesture.dy) <= 24 && draggedTo < collapsedOffset / 2);
          const target = shouldExpand ? 0 : collapsedOffset;
          Animated.spring(translateY, {
            bounciness: 0,
            toValue: target,
            useNativeDriver: true,
          }).start();
          currentSnapRef.current = target;
        },
      }),
    [collapsedOffset, dismissDisabled, onClose, translateY],
  );

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    // A collapsed sheet needs its measured height before its first snap can
    // be calculated. Keep the entrance state ready, then initialize after the
    // layout pass instead of letting the expanded default overwrite it.
    if (initialSnap === 'collapsed' && sheetHeight === 0) {
      translateY.setValue(reduceMotion ? 0 : 32);
      backdropOpacity.setValue(
        backdropVisible && reduceMotion ? 1 : 0,
      );
      return;
    }
    if (wasVisibleRef.current) {
      return;
    }
    wasVisibleRef.current = true;
    const targetOffset =
      initialSnap === 'collapsed' && sheetHeight > 0 ? collapsedOffset : 0;
    currentSnapRef.current = targetOffset;
    translateY.setValue(reduceMotion ? targetOffset : 32);
    backdropOpacity.setValue(
      backdropVisible && reduceMotion ? 1 : 0,
    );
    if (reduceMotion) {
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, {
        bounciness: 0,
        toValue: targetOffset,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        duration: 180,
        toValue: backdropVisible ? 1 : 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    backdropOpacity,
    backdropVisible,
    collapsedOffset,
    initialSnap,
    reduceMotion,
    sheetHeight,
    translateY,
    visible,
  ]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible
    >
      <View
        accessibilityLabel={accessibilityLabel}
        accessibilityViewIsModal
        style={styles.root}
      >
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          disabled={dismissDisabled}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        {/* edge-to-edge에서는 Modal이 adjustResize를 받지 못하므로
            시트 전체를 padding으로 밀어 올려 키보드 위에 유지한다. */}
        <KeyboardAvoidingView
          behavior="padding"
          pointerEvents="box-none"
          style={styles.keyboardArea}
        >
          <Animated.View
            onLayout={event => {
              const nextHeight = event.nativeEvent.layout.height;
              if (nextHeight !== sheetHeight) {
                setSheetHeight(nextHeight);
              }
            }}
            style={[styles.sheet, sheetStyle, {transform: [{translateY}]}]}
          >
            <View
              {...(dismissDisabled ? {} : panResponder.panHandlers)}
              style={styles.handleHitArea}
            >
              <View accessibilityElementsHidden style={styles.handle} />
            </View>
            <View
              style={[
                styles.contentContainer,
                {paddingBottom: Math.max(insets.bottom, 12)},
              ]}
            >
              {children}
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: COLORS.overlay,
  },
  contentContainer: {
    flexGrow: 1,
    flexShrink: 1,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: COLORS.textSubtle,
    borderRadius: RADII.pill,
    height: 5,
    width: 46,
  },
  handleHitArea: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  keyboardArea: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    overflow: 'hidden',
  },
});
