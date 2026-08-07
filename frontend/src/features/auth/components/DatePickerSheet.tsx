import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {AUTH_COLORS} from '../theme';

const ITEM_HEIGHT = 44;
const VISIBLE_ITEM_COUNT = 5;
const ENTER_EASING = Easing.bezier(0.32, 0.72, 0, 1);
const EXIT_EASING = Easing.bezier(0.23, 1, 0.32, 1);

interface DateParts {
  year: number;
  month: number;
  day: number;
}

interface DatePickerSheetProps {
  visible: boolean;
  value: string;
  // value가 비어 있을 때 휠이 시작할 기본 날짜. 없으면 오늘로 시작한다.
  initialValue?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

interface WheelProps {
  values: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  format?: (value: number) => string;
}

function Wheel({
  values,
  selectedValue,
  onValueChange,
  format = String,
}: WheelProps) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(values.indexOf(selectedValue), 0);
  const scrollToSelected = useCallback(() => {
    scrollRef.current?.scrollTo({
      y: selectedIndex * ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedIndex]);

  useEffect(() => {
    const frame = requestAnimationFrame(scrollToSelected);
    return () => cancelAnimationFrame(frame);
  }, [scrollToSelected]);

  return (
    <ScrollView
      ref={scrollRef}
      accessibilityRole="adjustable"
      contentContainerStyle={styles.wheelContent}
      decelerationRate="fast"
      onContentSizeChange={scrollToSelected}
      onMomentumScrollEnd={event => {
        const index = Math.round(
          event.nativeEvent.contentOffset.y / ITEM_HEIGHT,
        );
        const nextValue = values[Math.max(0, Math.min(index, values.length - 1))];
        if (nextValue !== undefined) {
          onValueChange(nextValue);
        }
      }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      style={styles.wheel}>
      {values.map(value => {
        const selected = value === selectedValue;
        return (
          <View key={value} style={styles.wheelItem}>
            <AppText style={[styles.wheelText, selected && styles.selectedText]}>
              {format(value)}
            </AppText>
          </View>
        );
      })}
    </ScrollView>
  );
}

export function parseDate(
  value: string,
  today = new Date(),
): DateParts {
  const [year, month, day] = value.split('-').map(Number);
  const hasValidParts =
    year !== undefined &&
    month !== undefined &&
    day !== undefined &&
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= 1900 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month);

  if (!hasValidParts) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
      day: today.getDate(),
    };
  }

  return {
    year,
    month,
    day,
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function DatePickerSheet({
  visible,
  value,
  initialValue,
  onCancel,
  onConfirm,
}: DatePickerSheetProps) {
  const initial = parseDate(value || initialValue || '');
  const [selected, setSelected] = useState<DateParts>(initial);
  const [reduceMotion, setReduceMotion] = useState(false);
  const insets = useSafeAreaInsets();
  const sheetHeight = 342 + insets.bottom;
  // 숨김 위치는 시트 전체 높이보다 커야 첫/마지막 프레임에 하단이 노출되지 않는다.
  const hiddenOffset = sheetHeight + 18;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(hiddenOffset)).current;
  const dismissingRef = useRef(false);
  const today = useMemo(() => new Date(), []);

  const years = useMemo(
    () =>
      Array.from(
        {length: today.getFullYear() - 1899},
        (_, index) => 1900 + index,
      ),
    [today],
  );
  const months = useMemo(
    () => Array.from({length: 12}, (_, index) => index + 1),
    [],
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      setSelected(parseDate(value || initialValue || ''));
      backdropOpacity.setValue(0);
      translateY.setValue(reduceMotion ? 0 : hiddenOffset);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: reduceMotion ? 0 : 280,
          easing: ENTER_EASING,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [
    backdropOpacity,
    hiddenOffset,
    initialValue,
    reduceMotion,
    translateY,
    value,
    visible,
  ]);

  const updatePart = (part: keyof DateParts, nextValue: number) => {
    setSelected(current => {
      const next = {...current, [part]: nextValue};
      const maximumDay = daysInMonth(next.year, next.month);
      next.day = Math.min(next.day, maximumDay);

      const nextDate = new Date(next.year, next.month - 1, next.day);
      if (nextDate > today) {
        return {
          year: today.getFullYear(),
          month: today.getMonth() + 1,
          day: today.getDate(),
        };
      }
      return next;
    });
  };

  const days = Array.from(
    {length: daysInMonth(selected.year, selected.month)},
    (_, index) => index + 1,
  );

  const dismiss = (afterDismiss: () => void) => {
    if (dismissingRef.current) {
      return;
    }
    dismissingRef.current = true;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: reduceMotion ? 0 : hiddenOffset,
        duration: reduceMotion ? 0 : 220,
        easing: EXIT_EASING,
        useNativeDriver: true,
      }),
    ]).start(({finished}) => {
      if (finished) {
        afterDismiss();
      } else {
        dismissingRef.current = false;
      }
    });
  };

  const handleConfirm = () => {
    const {year, month, day} = selected;
    dismiss(() =>
      onConfirm(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      ),
    );
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={() => dismiss(onCancel)}
      transparent
      visible={visible}>
      <View style={styles.overlay}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityLabel="날짜 선택 닫기"
          onPress={() => dismiss(onCancel)}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              height: sheetHeight,
              paddingBottom: insets.bottom,
            },
            {transform: [{translateY}]},
          ]}>
          <View style={styles.handle} />
          <View style={styles.actions}>
            <Pressable hitSlop={12} onPress={() => dismiss(onCancel)}>
              <AppText style={styles.cancel}>취소</AppText>
            </Pressable>
            <Pressable hitSlop={12} onPress={handleConfirm}>
              <AppText style={styles.confirm}>완료</AppText>
            </Pressable>
          </View>
          <View pointerEvents="none" style={styles.selectionHighlight} />
          <View style={styles.wheels}>
            <Wheel
              values={years}
              selectedValue={selected.year}
              onValueChange={nextValue => updatePart('year', nextValue)}
            />
            <Wheel
              values={months}
              selectedValue={selected.month}
              format={nextValue => String(nextValue).padStart(2, '0')}
              onValueChange={nextValue => updatePart('month', nextValue)}
            />
            <Wheel
              values={days}
              selectedValue={selected.day}
              format={nextValue => String(nextValue).padStart(2, '0')}
              onValueChange={nextValue => updatePart('day', nextValue)}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  sheet: {
    backgroundColor: AUTH_COLORS.background,
    borderColor: '#E0E3EB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    elevation: 12,
    paddingHorizontal: 24,
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: AUTH_COLORS.hairline,
    borderRadius: 2,
    height: 4,
    marginTop: 10,
    width: 42,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  cancel: {
    color: '#7A7D8A',
    fontSize: 20,
    fontWeight: '700',
  },
  confirm: {
    color: AUTH_COLORS.primary,
    fontSize: 20,
    fontWeight: '700',
  },
  wheels: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * VISIBLE_ITEM_COUNT,
  },
  wheel: {
    flex: 1,
  },
  wheelContent: {
    paddingVertical: ITEM_HEIGHT * 2,
  },
  wheelItem: {
    alignItems: 'center',
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  wheelText: {
    color: '#B0B2BD',
    fontSize: 16,
  },
  selectedText: {
    color: '#6E5CE8',
    fontSize: 20,
    fontWeight: '700',
  },
  selectionHighlight: {
    backgroundColor: 'rgba(143, 125, 245, 0.06)',
    borderRadius: 10,
    height: ITEM_HEIGHT,
    left: 24,
    position: 'absolute',
    right: 24,
    top: 74 + ITEM_HEIGHT * 2,
  },
});
