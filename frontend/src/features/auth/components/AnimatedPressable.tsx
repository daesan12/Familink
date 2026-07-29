import {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface AnimatedPressableProps extends PressableProps {
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export function AnimatedPressable({
  children,
  containerStyle,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: AnimatedPressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  const animateScale = (toValue: number) => {
    scale.stopAnimation();
    opacity.stopAnimation();

    if (reduceMotion) {
      scale.setValue(1);
      Animated.timing(opacity, {
        toValue: toValue < 1 ? 0.88 : 1,
        duration: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    opacity.setValue(1);
    Animated.timing(scale, {
      toValue,
      duration: 160,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        containerStyle,
        styles.animated,
        {opacity, transform: [{scale}]},
        disabled && styles.disabled,
      ]}>
      <Pressable
        {...props}
        disabled={disabled}
        onPressIn={event => {
          animateScale(0.97);
          onPressIn?.(event);
        }}
        onPressOut={event => {
          animateScale(1);
          onPressOut?.(event);
        }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

const styles = {
  animated: {
    opacity: 1,
  },
  disabled: {
    opacity: 0.6,
  },
} as const;
