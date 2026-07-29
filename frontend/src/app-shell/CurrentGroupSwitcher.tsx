import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FamilyGroup } from './types';

interface CurrentGroupSwitcherProps {
  currentGroup: FamilyGroup;
  groups: readonly FamilyGroup[];
  isOpen: boolean;
  onClose: () => void;
  onSelect: (groupId: string) => void;
  onToggle: () => void;
}

export function CurrentGroupSwitcher({
  currentGroup,
  groups,
  isOpen,
  onClose,
  onSelect,
  onToggle,
}: CurrentGroupSwitcherProps) {
  return (
    <>
      <Pressable
        accessibilityHint="다른 가족 그룹으로 전환합니다"
        accessibilityRole="button"
        onPress={onToggle}
        style={styles.trigger}
      >
        <Text numberOfLines={1} style={styles.triggerText}>
          {currentGroup.name}
        </Text>
        <Text accessibilityElementsHidden style={styles.chevron}>
          {isOpen ? '⌃' : '⌄'}
        </Text>
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={onClose}
        transparent
        visible={isOpen}
      >
        <Pressable
          accessibilityLabel="그룹 전환 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        >
          <View
            accessibilityRole="menu"
            onStartShouldSetResponder={() => true}
            style={styles.menu}
          >
            <Text style={styles.title}>현재 그룹 선택</Text>
            {groups.map(group => {
              const isSelected = group.id === currentGroup.id;

              return (
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSelected }}
                  key={group.id}
                  onPress={() => onSelect(group.id)}
                  style={[styles.option, isSelected && styles.selectedOption]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                    ]}
                  >
                    {group.name}
                  </Text>
                  {isSelected ? <Text>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(25, 27, 31, 0.32)',
    flex: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 72,
  },
  chevron: {
    color: '#6F6B68',
    fontSize: 18,
    marginLeft: 8,
  },
  menu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 8,
  },
  option: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  optionText: {
    color: '#525252',
    fontSize: 16,
  },
  selectedOption: {
    backgroundColor: '#F2F0EE',
  },
  selectedOptionText: {
    color: '#4F4B48',
    fontWeight: '700',
  },
  title: {
    color: '#252525',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trigger: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 4,
  },
  triggerText: {
    color: '#34312F',
    fontSize: 18,
    fontWeight: '700',
    maxWidth: 220,
  },
});
