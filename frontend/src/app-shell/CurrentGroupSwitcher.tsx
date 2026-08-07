import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {COLORS, RADII} from '../design/tokens';
import {AppText} from '../shared/components/AppText';
import {DraggableBottomSheet} from '../shared/components/DraggableBottomSheet';
import type {FamilyGroup} from './types';

interface CurrentGroupSwitcherProps {
  currentGroup: FamilyGroup;
  groups: readonly FamilyGroup[];
  isOpen: boolean;
  onClose: () => void;
  onCreateGroup?: () => void;
  onJoinGroup?: () => void;
  onSelect: (groupId: string) => void;
  onToggle: () => void;
}

export function CurrentGroupSwitcher({
  currentGroup,
  groups,
  isOpen,
  onClose,
  onCreateGroup,
  onJoinGroup,
  onSelect,
  onToggle,
}: CurrentGroupSwitcherProps) {
  const orderedGroups = [
    currentGroup,
    ...groups.filter(group => group.id !== currentGroup.id),
  ];

  return (
    <>
      <Pressable
        accessibilityHint="다른 가족 그룹으로 전환합니다"
        accessibilityRole="button"
        onPress={onToggle}
        style={styles.trigger}
      >
        <AppText numberOfLines={1} style={styles.triggerText}>
          {currentGroup.name}
        </AppText>
        <MaterialDesignIcons
          accessibilityElementsHidden
          color={COLORS.textStrong}
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={24}
        />
      </Pressable>

      <DraggableBottomSheet
        accessibilityLabel="그룹 선택"
        backdropVisible={false}
        collapsedHeight={260}
        initialSnap="collapsed"
        maxHeightRatio={0.58}
        onClose={onClose}
        sheetStyle={styles.sheet}
        visible={isOpen}
      >
        <View style={styles.body}>
          <AppText style={styles.title}>그룹 선택</AppText>
          <ScrollView
            accessibilityRole="menu"
            contentContainerStyle={styles.options}
            showsVerticalScrollIndicator={false}
          >
            {orderedGroups.map(group => {
              const isSelected = group.id === currentGroup.id;

              return (
                <Pressable
                  accessibilityRole="menuitem"
                  accessibilityState={{selected: isSelected}}
                  key={group.id}
                  onPress={() => onSelect(group.id)}
                  style={({pressed}) => [
                    styles.option,
                    isSelected && styles.selectedOption,
                    pressed && !isSelected && styles.pressedOption,
                  ]}
                >
                  <AppText
                    style={[
                      styles.optionText,
                      isSelected && styles.selectedOptionText,
                    ]}
                  >
                    {group.name}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <GroupAction label="새 그룹 만들기" onPress={onCreateGroup} />
            <GroupAction label="그룹 참가하기" onPress={onJoinGroup} />
          </View>
        </View>
      </DraggableBottomSheet>
    </>
  );
}

interface GroupActionProps {
  label: string;
  onPress?: () => void;
}

function GroupAction({label, onPress}: GroupActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({pressed}) => [
        styles.action,
        pressed && styles.actionPressed,
        !onPress && styles.actionDisabled,
      ]}
    >
      <MaterialDesignIcons
        color={COLORS.textStrong}
        name="plus"
        size={18}
      />
      <AppText style={styles.actionText}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flex: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 64,
  },
  actionDisabled: {
    opacity: 0.75,
  },
  actionPressed: {
    backgroundColor: COLORS.lavender,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  actionText: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  // flexShrink 기본값 0을 덮어써야 시트가 상한에 걸릴 때 이 래퍼가 줄어들고,
  // 안쪽 목록만 스크롤되면서 하단 액션 버튼이 계속 보인다.
  body: {
    flexShrink: 1,
  },
  option: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: 16,
  },
  optionText: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  options: {
    paddingHorizontal: 16,
  },
  pressedOption: {
    backgroundColor: COLORS.surface,
  },
  selectedOption: {
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderBottomWidth: 0,
  },
  selectedOptionText: {
    color: COLORS.textStrong,
    fontWeight: '700',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderCurve: 'continuous',
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    boxShadow: '0 -4px 16px rgba(18, 23, 41, 0.12)',
    overflow: 'hidden',
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 32,
    paddingBottom: 8,
    paddingTop: 8,
    textAlign: 'center',
  },
  trigger: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    minHeight: 48,
  },
  triggerText: {
    color: COLORS.textStrong,
    fontSize: 20,
    fontWeight: '700',
    maxWidth: 210,
  },
});
