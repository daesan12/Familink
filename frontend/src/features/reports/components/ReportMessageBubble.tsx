import {useState} from "react";
import type {LayoutChangeEvent} from "react-native";
import {StyleSheet, View} from "react-native";
import Svg, {Path} from "react-native-svg";

import {COLORS} from "../../../design/tokens";
import {AppText} from "../../../shared/components/AppText";

const BORDER_INSET = 0.5;
const BUBBLE_RADIUS = 16;
const TAIL_HEIGHT = 22;

interface BubbleSize {
  height: number;
  width: number;
}

interface ReportMessageBubbleProps {
  message: string;
  minHeight?: number;
}

export function ReportMessageBubble({
  message,
  minHeight,
}: ReportMessageBubbleProps) {
  const [size, setSize] = useState<BubbleSize>({height: 0, width: 0});

  const handleLayout = ({nativeEvent}: LayoutChangeEvent) => {
    const {height, width} = nativeEvent.layout;
    if (height !== size.height || width !== size.width) {
      setSize({height, width});
    }
  };

  const path = createBubblePath(size);

  return (
    <View onLayout={handleLayout} style={styles.bubble}>
      {path ? (
        <Svg
          accessibilityElementsHidden
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <Path
            d={path}
            fill={COLORS.background}
            stroke={COLORS.textMuted}
            strokeLinejoin="round"
            strokeWidth={1}
          />
        </Svg>
      ) : null}
      <View style={[styles.content, minHeight ? {minHeight} : null]}>
        <AppText style={styles.message}>{message}</AppText>
      </View>
    </View>
  );
}

function createBubblePath({height, width}: BubbleSize): string | null {
  if (height <= TAIL_HEIGHT || width <= BUBBLE_RADIUS * 2) {
    return null;
  }

  const left = BORDER_INSET;
  const top = BORDER_INSET;
  const right = width - BORDER_INSET;
  const bottom = height - TAIL_HEIGHT - BORDER_INSET;
  const radius = Math.min(BUBBLE_RADIUS, bottom / 2, width / 2);
  const tailBaseRight = Math.max(radius + 42, right - 42);
  const tailBaseLeft = Math.max(radius, tailBaseRight - 30);
  const tailTipX = Math.min(right - radius - 2, tailBaseRight + 10);
  const tailTipY = height - BORDER_INSET;

  return [
    `M ${left + radius} ${top}`,
    `H ${right - radius}`,
    `Q ${right} ${top} ${right} ${top + radius}`,
    `V ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `H ${tailBaseRight}`,
    `L ${tailTipX} ${tailTipY}`,
    `L ${tailBaseLeft} ${bottom}`,
    `H ${left + radius}`,
    `Q ${left} ${bottom} ${left} ${bottom - radius}`,
    `V ${top + radius}`,
    `Q ${left} ${top} ${left + radius} ${top}`,
    "Z",
  ].join(" ");
}

const styles = StyleSheet.create({
  bubble: {
    paddingBottom: TAIL_HEIGHT,
    position: "relative",
  },
  content: {
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  message: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 24,
  },
});
