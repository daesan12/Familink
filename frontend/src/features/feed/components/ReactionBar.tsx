import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useRef} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

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
  isPickerOpen: boolean;
  onTogglePicker: (anchor: ReactionAnchor) => void;
  reactions: readonly FeedReaction[];
  selectedReactionId: ReactionId | null;
}

export function ReactionBar({
  canReact,
  isPickerOpen,
  onTogglePicker,
  reactions,
  selectedReactionId,
}: ReactionBarProps) {
  const addButtonRef = useRef<View>(null);

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
    <View accessibilityRole="summary" style={styles.container}>
      {reactions
        .filter(reaction => reaction.count > 0)
        .map(reaction => {
          const isSelected = reaction.id === selectedReactionId;

          return (
            <View
              accessibilityLabel={`${reaction.label} 반응 ${reaction.count}개${
                isSelected ? ', 내가 선택함' : ''
              }`}
              key={reaction.id}
              style={[styles.chip, isSelected && styles.selectedChip]}
            >
              <Text style={styles.emoji}>{reaction.emoji}</Text>
              <Text
                style={[
                  styles.count,
                  isSelected && styles.selectedCount,
                ]}
              >
                {reaction.count}
              </Text>
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
    </View>
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
