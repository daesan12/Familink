import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useRef, useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {ArchiveMember, ArchiveMemberFilter as MemberFilter} from '../types';

interface ArchiveMemberFilterProps {
  members: readonly ArchiveMember[];
  onSelect: (memberId: MemberFilter) => void;
  selectedMemberId: MemberFilter;
}

interface Anchor {
  height: number;
  width: number;
  x: number;
  y: number;
}

const ALL_LABEL = '모두';

export function ArchiveMemberFilter({
  members,
  onSelect,
  selectedMemberId,
}: ArchiveMemberFilterProps) {
  const {width: windowWidth} = useWindowDimensions();
  const triggerRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const selectedMember = members.find(
    member => member.id === selectedMemberId,
  );
  const triggerLabel = selectedMember?.name ?? ALL_LABEL;

  const openMenu = () => {
    setIsOpen(true);
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({height, width, x, y});
    });
  };

  const closeMenu = () => {
    setIsOpen(false);
    setAnchor(null);
  };

  const handleSelect = (memberId: MemberFilter) => {
    onSelect(memberId);
    closeMenu();
  };

  return (
    <>
      <Pressable
        accessibilityHint="구성원별로 게시글을 필터링합니다"
        accessibilityLabel={`구성원 필터: ${triggerLabel}`}
        accessibilityRole="button"
        onPress={openMenu}
        ref={triggerRef}
        style={styles.trigger}
      >
        <Text numberOfLines={1} style={styles.triggerText}>
          {triggerLabel}
        </Text>
        <MaterialDesignIcons
          accessibilityElementsHidden
          color={COLORS.textStrong}
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
        />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={closeMenu}
        transparent
        visible={isOpen}
      >
        <Pressable
          accessibilityLabel="구성원 필터 닫기"
          accessibilityRole="button"
          onPress={closeMenu}
          style={styles.backdrop}
        />
        {isOpen ? (
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              anchor
                ? {
                    right: Math.max(
                      windowWidth - (anchor.x + anchor.width),
                      12,
                    ),
                    top: anchor.y + anchor.height + 6,
                  }
                : styles.menuFallback,
            ]}
          >
            <MenuOption
              isSelected={selectedMemberId == null}
              label={ALL_LABEL}
              onPress={() => handleSelect(null)}
            />
            {members.map(member => (
              <MenuOption
                isSelected={member.id === selectedMemberId}
                key={member.id}
                label={member.name}
                onPress={() => handleSelect(member.id)}
              />
            ))}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

interface MenuOptionProps {
  isSelected: boolean;
  label: string;
  onPress: () => void;
}

function MenuOption({isSelected, label, onPress}: MenuOptionProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="menuitem"
      accessibilityState={{selected: isSelected}}
      onPress={onPress}
      style={({pressed}) => [
        styles.option,
        pressed && styles.optionPressed,
      ]}
    >
      <Text
        style={[styles.optionText, isSelected && styles.optionTextSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  menu: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    boxShadow: '0 6px 18px rgba(18, 23, 41, 0.14)',
    minWidth: 128,
    paddingVertical: 4,
    position: 'absolute',
  },
  menuFallback: {
    right: 16,
    top: 100,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  optionPressed: {
    backgroundColor: COLORS.surface,
  },
  optionText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: COLORS.purpleDeep,
    fontWeight: '700',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    flexDirection: 'row',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: 14,
  },
  triggerText: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 120,
  },
});
