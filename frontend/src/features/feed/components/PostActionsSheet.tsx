import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useEffect,
  useRef,
  useState} from 'react';
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {COLORS, RADII} from '../../../design/tokens';

interface PostActionsSheetProps {
  deleteLabel?: string;
  dismissLabel?: string;
  editLabel?: string;
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function PostActionsSheet({
  deleteLabel = '삭제하기',
  dismissLabel = '게시글 메뉴 닫기',
  editLabel = '수정하기',
  isOpen,
  onClose,
  onDelete,
  onEdit,
}: PostActionsSheetProps) {
  const {height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isModalVisible, setIsModalVisible] = useState(isOpen);
  const translateY = useRef(new Animated.Value(windowHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(isOpen);
  isOpenRef.current = isOpen;

  const closeFromGesture = () => {
    translateY.setValue(0);
    onClose();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 6 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        translateY.setValue(Math.max(0, gestureState.dy));
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 64 || gestureState.vy > 0.75) {
          closeFromGesture();
          return;
        }

        Animated.spring(translateY, {
          damping: 22,
          stiffness: 240,
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (isOpen) {
      setIsModalVisible(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isModalVisible) {
      translateY.setValue(windowHeight);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: isOpen ? 180 : 140,
        easing: isOpen ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        toValue: isOpen ? 1 : 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: isOpen ? 260 : 200,
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
    translateY,
    windowHeight,
  ]);

  return (
    <Modal
      animationType="none"
      onRequestClose={onClose}
      transparent
      visible={isModalVisible}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.dim, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityLabel={dismissLabel}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.dismissArea}
        />
        <Animated.View
          style={[
            styles.sheet,
            {paddingBottom: 12 + insets.bottom},
            {transform: [{translateY}]},
          ]}
          {...panResponder.panHandlers}
        >
          <View accessibilityElementsHidden style={styles.handle} />
          <SheetAction
            icon="pencil-outline"
            label={editLabel}
            onPress={onEdit}
          />
          <View style={styles.divider} />
          <SheetAction
            danger
            icon="trash-can-outline"
            label={deleteLabel}
            onPress={onDelete}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

interface SheetActionProps {
  danger?: boolean;
  icon: 'pencil-outline' | 'trash-can-outline';
  label: string;
  onPress: () => void;
}

function SheetAction({danger = false, icon, label, onPress}: SheetActionProps) {
  const color = danger ? '#EE5252' : '#616675';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.action, pressed && styles.pressedAction]}
    >
      <MaterialDesignIcons color={color} name={icon} size={26} />
      <AppText style={[styles.actionText, {color}]}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    minHeight: 64,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    minWidth: 72,
  },
  dim: {
    backgroundColor: COLORS.overlay,
    inset: 0,
    position: 'absolute',
  },
  dismissArea: {
    inset: 0,
    position: 'absolute',
  },
  divider: {
    backgroundColor: COLORS.divider,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: '#BDBDBD',
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 3,
    marginBottom: 5,
    width: 70,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pressedAction: {
    backgroundColor: COLORS.surface,
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
});
