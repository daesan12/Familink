import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useRef} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {FeedReaction, ReactionId} from '../types';

export interface ReactionAnchor {
  height: number;
  width: number;
  x: number;
  y: number;
}

interface ReactionBarProps {
  canReact: boolean;
  isVisible?: boolean;
  isPickerOpen: boolean;
  onSelectReaction: (reactionId: ReactionId) => void;
  onTogglePicker: (anchor: ReactionAnchor) => void;
  reactions: readonly FeedReaction[];
  selectedReactionId: ReactionId | null;
}

export function ReactionBar({
  canReact,
  isVisible = true,
  isPickerOpen,
  onSelectReaction,
  onTogglePicker,
  reactions,
  selectedReactionId,
}: ReactionBarProps) {
  const addButtonRef = useRef<View>(null);
  const visibilityProgress = useRef(new Animated.Value(0)).current;
  const reactionPulse = useRef(new Animated.Value(1)).current;
  const previousSelectedReactionId = useRef<
    ReactionId | null | undefined
  >(undefined);

  useEffect(() => {
    if (!isVisible) {
      visibilityProgress.setValue(0);
      return;
    }

    Animated.spring(visibilityProgress, {
      bounciness: 5,
      speed: 18,
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [isVisible, visibilityProgress]);

  useEffect(() => {
    const previousReactionId = previousSelectedReactionId.current;
    previousSelectedReactionId.current = selectedReactionId;

    if (
      previousReactionId === undefined ||
      previousReactionId === selectedReactionId
    ) {
      return;
    }

    reactionPulse.setValue(1);
    Animated.sequence([
      Animated.timing(reactionPulse, {
        duration: 90,
        toValue: 1.05,
        useNativeDriver: true,
      }),
      Animated.spring(reactionPulse, {
        bounciness: 4,
        speed: 20,
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [reactionPulse, selectedReactionId]);

  const handleTogglePicker = () => {
    if (!canReact) {
      return;
    }
    if (isPickerOpen) {
      onTogglePicker({height: 0, width: 0, x: 0, y: 0});
      return;
    }

    addButtonRef.current?.measureInWindow((x, y, width, height) => {
      onTogglePicker({height, width, x, y});
    });
  };

  return (
    <Animated.View
      accessibilityRole="summary"
      style={[
        styles.container,
        {
          opacity: visibilityProgress,
          transform: [
            {
              translateY: visibilityProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [6, 0],
              }),
            },
            {
              scale: Animated.multiply(
                visibilityProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.96, 1],
                }),
                reactionPulse,
              ),
            },
          ],
        },
      ]}
    >
      {reactions
        .filter(reaction => reaction.count > 0)
        .map(reaction => {
          const isSelected = reaction.id === selectedReactionId;

          const chipContent = (
            <>
              <Text style={styles.emoji}>{reaction.emoji}</Text>
              <Text
                style={[
                  styles.count,
                  isSelected && styles.selectedCount,
                ]}
              >
                {reaction.count}
              </Text>
            </>
          );

          if (canReact) {
            return (
              <Pressable
                accessibilityHint={
                  isSelected
                    ? '다시 누르면 이 반응이 취소됩니다.'
                    : '누르면 이 반응을 선택합니다.'
                }
                accessibilityLabel={`${reaction.label} 반응 ${reaction.count}개${
                  isSelected ? ', 내가 선택함' : ''
                }`}
                accessibilityRole="button"
                hitSlop={8}
                key={reaction.id}
                onPress={() => onSelectReaction(reaction.id)}
                style={[styles.chip, isSelected && styles.selectedChip]}
              >
                {chipContent}
              </Pressable>
            );
          }

          return (
            <View
              accessibilityLabel={`${reaction.label} 반응 ${reaction.count}개`}
              key={reaction.id}
              style={styles.chip}
            >
              {chipContent}
            </View>
          );
        })}
      {canReact ? (
        <Pressable
          accessibilityLabel={
            isPickerOpen ? '반응 선택 닫기' : '게시글 반응 추가'
          }
          accessibilityRole="button"
          accessibilityState={{expanded: isPickerOpen}}
          onPress={handleTogglePicker}
          ref={addButtonRef}
          style={styles.addButtonTouchArea}
        >
          <View style={styles.addButton}>
            <MaterialDesignIcons
              color={COLORS.textStrong}
              name="plus"
              size={17}
            />
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  addButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  addButtonTouchArea: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderColor: 'transparent',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    height: 28,
    paddingHorizontal: 8,
  },
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  count: {
    color: COLORS.textStrong,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
  },
  emoji: {
    fontSize: 14,
  },
  selectedChip: {
    backgroundColor: COLORS.lavenderSurface,
    borderColor: COLORS.purple,
  },
  selectedCount: {
    color: COLORS.purpleDeep,
  },
});
