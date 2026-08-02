import {Modal, Pressable, StyleSheet, Text, useWindowDimensions, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {REACTION_OPTIONS} from '../interactions/postInteractions';
import type {ReactionId} from '../types';
import type {ReactionAnchor} from './ReactionBar';

const EDGE_MARGIN = 12;
const POPOVER_GAP = 8;
const POPOVER_HEIGHT = 52;
const POPOVER_WIDTH = 236;

interface ReactionPopoverProps {
  anchor: ReactionAnchor;
  onClose: () => void;
  onSelect: (reactionId: ReactionId) => void;
  selectedReactionId: ReactionId | null;
  visible: boolean;
}

export function ReactionPopover({
  anchor,
  onClose,
  onSelect,
  selectedReactionId,
  visible,
}: ReactionPopoverProps) {
  const {height: windowHeight, width: windowWidth} = useWindowDimensions();
  const anchorTouchHeight = Math.max(44, anchor.height);
  const anchorTouchWidth = Math.max(44, anchor.width);
  const left = Math.min(
    Math.max(
      EDGE_MARGIN,
      anchor.x + anchor.width / 2 - POPOVER_WIDTH / 2,
    ),
    Math.max(EDGE_MARGIN, windowWidth - POPOVER_WIDTH - EDGE_MARGIN),
  );
  const top =
    anchor.y >= POPOVER_HEIGHT + POPOVER_GAP + EDGE_MARGIN
      ? anchor.y - POPOVER_HEIGHT - POPOVER_GAP
      : Math.min(
          anchor.y + anchor.height + POPOVER_GAP,
          windowHeight - POPOVER_HEIGHT - EDGE_MARGIN,
        );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="반응 선택 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          accessibilityLabel="반응 추가 버튼 다시 눌러 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={[
            styles.anchorDismissButton,
            {
              height: anchorTouchHeight,
              left:
                anchor.x + anchor.width / 2 - anchorTouchWidth / 2,
              top:
                anchor.y + anchor.height / 2 - anchorTouchHeight / 2,
              width: anchorTouchWidth,
            },
          ]}
        />
        <View
          accessibilityLabel="게시글 반응 선택"
          accessibilityRole="menu"
          style={[styles.popover, {left, top}]}
        >
          {REACTION_OPTIONS.map(reaction => (
            <Pressable
              accessibilityLabel={reaction.label}
              accessibilityRole="menuitem"
              accessibilityState={{
                selected: reaction.id === selectedReactionId,
              }}
              key={reaction.id}
              onPress={() => onSelect(reaction.id)}
              style={[
                styles.reactionButton,
                reaction.id === selectedReactionId &&
                  styles.selectedReactionButton,
              ]}
            >
              <Text style={styles.emoji}>{reaction.emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  anchorDismissButton: {
    position: 'absolute',
  },
  emoji: {
    fontSize: 22,
  },
  modalRoot: {
    flex: 1,
  },
  popover: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    boxShadow: '0 4px 14px rgba(18, 23, 41, 0.16)',
    flexDirection: 'row',
    height: POPOVER_HEIGHT,
    paddingHorizontal: 8,
    position: 'absolute',
    width: POPOVER_WIDTH,
  },
  reactionButton: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  selectedReactionButton: {
    backgroundColor: COLORS.lavenderSurface,
  },
});
