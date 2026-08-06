import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useEffect,
  useRef,
  useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {AppText} from '../shared/components/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {COLORS, RADII} from '../design/tokens';
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
  const {height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const orderedGroups = [
    currentGroup,
    ...groups.filter(group => group.id !== currentGroup.id),
  ];
  const [isModalVisible, setIsModalVisible] = useState(isOpen);
  const [reduceMotion, setReduceMotion] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(windowHeight)).current;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setIsModalVisible(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isModalVisible) {
      sheetTranslateY.setValue(windowHeight);
    }
  }, [isModalVisible, sheetTranslateY, windowHeight]);

  useEffect(() => {
    if (!isModalVisible) {
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: reduceMotion ? 0 : isOpen ? 180 : 140,
        easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        toValue: isOpen ? 1 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        duration: reduceMotion ? 0 : isOpen ? 280 : 220,
        easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        toValue: isOpen ? 0 : windowHeight,
        useNativeDriver: true,
      }),
    ]);

    animation.start(({finished}) => {
      if (finished && !isOpenRef.current) {
        setIsModalVisible(false);
      }
    });

    return () => animation.stop();
  }, [
    backdropOpacity,
    isModalVisible,
    isOpen,
    reduceMotion,
    sheetTranslateY,
    windowHeight,
  ]);

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

      <Modal
        animationType="none"
        onRequestClose={onClose}
        transparent
        visible={isModalVisible}
      >
        <View style={styles.modalRoot}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dim,
              {
                opacity: backdropOpacity,
              },
            ]}
          />
          <Pressable
            accessibilityLabel="그룹 전환 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.dismissArea}
          />
          <Animated.View
            onStartShouldSetResponder={() => true}
            style={[
              styles.sheet,
              {
                paddingBottom: 24 + insets.bottom,
                transform: [{translateY: sheetTranslateY}],
              },
            ]}
          >
            <View accessibilityElementsHidden style={styles.handle} />
            <AppText style={styles.title}>그룹 선택</AppText>
            <View accessibilityRole="menu" style={styles.options}>
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
            </View>
            <View style={styles.actions}>
              <GroupAction
                label="새 그룹 만들기"
                onPress={onCreateGroup}
              />
              <GroupAction label="그룹 참가하기" onPress={onJoinGroup} />
            </View>
          </Animated.View>
        </View>
      </Modal>
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
  dim: {
    backgroundColor: COLORS.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dismissArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#BDBDBD',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 5,
    width: 70,
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
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
    borderColor: 'rgba(120, 113, 108, 0.7)',
    borderCurve: 'continuous',
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    borderWidth: 1,
    boxShadow: '0 -4px 16px rgba(18, 23, 41, 0.12)',
    paddingTop: 10,
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
