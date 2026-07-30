import {useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type ImageStyle,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';

const ILLUSTRATION_SHADOW = require('../../../assets/images/illustration-shadow.png');

interface FloatingIllustrationProps {
  accessibilityIgnoresInvertColors?: boolean;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  groundShadowStyle: StyleProp<ImageStyle>;
  source: number;
  style: StyleProp<ImageStyle>;
}

export function FloatingIllustration({
  accessibilityIgnoresInvertColors,
  accessibilityLabel,
  containerStyle,
  groundShadowStyle,
  source,
  style,
}: FloatingIllustrationProps) {
  const floatY = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      floatY.stopAnimation();
      floatY.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [floatY, reduceMotion]);

  const shadowOpacity = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0.65],
  });
  const shadowScale = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.88],
  });
  const translateY = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -9],
  });
  const rotate = floatY.interpolate({
    inputRange: [0, 1],
    outputRange: ['-0.6deg', '0.6deg'],
  });
  const animatedShadowStyle = {
    opacity: reduceMotion ? 0.82 : shadowOpacity,
    transform: [{scaleX: shadowScale}],
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.Image
        accessible={false}
        resizeMode="stretch"
        source={ILLUSTRATION_SHADOW}
        style={[
          groundShadowStyle,
          animatedShadowStyle,
        ]}
      />
      <Animated.View style={{transform: [{translateY}, {rotate}]}}>
        <Image
          accessibilityIgnoresInvertColors={
            accessibilityIgnoresInvertColors
          }
          accessibilityLabel={accessibilityLabel}
          accessible={accessibilityLabel !== undefined}
          resizeMode="contain"
          source={source}
          style={style}
        />
      </Animated.View>
    </View>
  );
}

const styles = {
  container: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
} as const;
