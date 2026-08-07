import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Animated,
  AccessibilityInfo,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {COLORS, RADII} from '../../design/tokens';

const DEFAULT_MAX_HEIGHT_RATIO = 0.85;
/** 콘텐츠가 시스템 바에 닿지 않도록 인셋 위에 항상 더하는 여백. */
const BOTTOM_GAP = 12;
/**
 * Modal 안에서는 useSafeAreaInsets가 같은 시트를 다시 열 때 bottom을 0으로
 * 돌려주는 경우가 있다(실측: 48 → 0). 그대로 쓰면 하단 여백이 무너져 콘텐츠가
 * 내비게이션 바에 겹치므로, 앱 시작 시 측정한 값을 하한으로 함께 쓴다.
 */
const MEASURED_BOTTOM_INSET = initialWindowMetrics?.insets.bottom ?? 0;

interface DraggableBottomSheetProps {
  accessibilityLabel: string;
  /** 바텀시트 뒤의 화면을 어둡게 할지 여부. 투명해도 바깥 터치 닫기는 유지한다. */
  backdropVisible?: boolean;
  children: React.ReactNode;
  dismissDisabled?: boolean;
  /** 처음 열릴 때 화면에 보일 높이. 설정하면 위로 끌어 펼칠 수 있다. */
  collapsedHeight?: number;
  initialSnap?: 'collapsed' | 'expanded';
  /**
   * 시트가 차지할 수 있는 최대 높이 비율. 부모 여백을 뺀 영역 기준이라
   * 키보드가 올라오면 상한도 함께 줄어든다.
   */
  maxHeightRatio?: number;
  onClose: () => void;
  /** 배경·모서리·그림자 전용. 높이는 `maxHeightRatio`로 조절한다. */
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
  maxHeightRatio = DEFAULT_MAX_HEIGHT_RATIO,
  onClose,
  sheetStyle,
  visible,
}: DraggableBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const translateY = useRef(new Animated.Value(32)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const gestureStartRef = useRef(0);
  const wasVisibleRef = useRef(false);
  const bottomInset = Math.max(insets.bottom, MEASURED_BOTTOM_INSET);
  // 키보드가 올라오면 내비게이션 바는 키보드 뒤로 들어간다. 그때도 인셋만큼
  // 여백을 두면 버튼 아래에 쓸모없는 흰 띠만 남아 조작을 가린다.
  const contentPaddingBottom = keyboardVisible
    ? BOTTOM_GAP
    : bottomInset + BOTTOM_GAP;

  const collapsible = initialSnap === 'collapsed';
  // 접힘을 translateY로 구현하면 시트 아래쪽이 화면 밖으로 나가면서 하단 여백이
  // 사라지고 콘텐츠가 내비게이션 바를 침범한다. 대신 상한 높이를 줄였다 늘려
  // 시트가 항상 화면 안에 머물게 하고, 넘치는 내용은 시트 안에서 스크롤한다.
  const collapsedLimit = collapsedHeight + bottomInset;
  const expandedLimit = Math.round(windowHeight * maxHeightRatio);
  const snapLimit = useRef(new Animated.Value(collapsedLimit)).current;
  const currentLimitRef = useRef(collapsedLimit);
  // 접히지 않는 시트는 상한을 비율 문자열로 둔다. 부모 여백 기준이라 키보드가
  // 올라오면 상한도 함께 줄어든다.
  const staticMaxHeight = `${Math.round(maxHeightRatio * 100)}%` as const;

  const settleLimit = (target: number) => {
    currentLimitRef.current = target;
    if (reduceMotion) {
      snapLimit.setValue(target);
      return;
    }
    Animated.spring(snapLimit, {
      bounciness: 0,
      toValue: target,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setKeyboardVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setKeyboardVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
          gestureStartRef.current = currentLimitRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          // 위로 끌면(dy 음수) 상한이 커지고, 아래로 끌면 작아진다.
          const requested = gestureStartRef.current - gesture.dy;
          if (collapsible) {
            snapLimit.setValue(
              Math.min(Math.max(requested, collapsedLimit), expandedLimit),
            );
          }
          // 접힘 하한보다 더 아래로 끄는 만큼은 닫기 제스처로 따라 내린다.
          translateY.setValue(Math.max(0, collapsedLimit - requested));
        },
        onPanResponderRelease: (_, gesture) => {
          if (dismissDisabled) {
            Animated.spring(translateY, {
              bounciness: 0,
              toValue: 0,
              useNativeDriver: false,
            }).start();
            return;
          }
          if (gesture.dy > 90 || gesture.vy > 0.8) {
            Animated.timing(translateY, {
              duration: 160,
              toValue: 600,
              useNativeDriver: false,
            }).start(onClose);
            return;
          }
          Animated.spring(translateY, {
            bounciness: 0,
            toValue: 0,
            useNativeDriver: false,
          }).start();
          if (!collapsible) {
            return;
          }
          const draggedTo = gestureStartRef.current - gesture.dy;
          const shouldExpand =
            gesture.dy < -24 ||
            (Math.abs(gesture.dy) <= 24 &&
              draggedTo > (collapsedLimit + expandedLimit) / 2);
          settleLimit(shouldExpand ? expandedLimit : collapsedLimit);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      collapsedLimit,
      collapsible,
      dismissDisabled,
      expandedLimit,
      onClose,
      reduceMotion,
      snapLimit,
      translateY,
    ],
  );

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) {
      return;
    }
    wasVisibleRef.current = true;
    // 상한은 레이아웃 측정 없이 정해지므로 열리는 즉시 접힘 상태로 시작한다.
    const initialLimit = collapsible ? collapsedLimit : expandedLimit;
    currentLimitRef.current = initialLimit;
    snapLimit.setValue(initialLimit);
    translateY.setValue(reduceMotion ? 0 : 32);
    backdropOpacity.setValue(
      backdropVisible && reduceMotion ? 1 : 0,
    );
    if (reduceMotion) {
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, {
        bounciness: 0,
        toValue: 0,
        useNativeDriver: false,
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
    collapsedLimit,
    collapsible,
    expandedLimit,
    reduceMotion,
    snapLimit,
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
            style={[
              styles.sheet,
              sheetStyle,
              {
                maxHeight: collapsible ? snapLimit : staticMaxHeight,
                transform: [{translateY}],
              },
            ]}
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
                {paddingBottom: contentPaddingBottom},
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
