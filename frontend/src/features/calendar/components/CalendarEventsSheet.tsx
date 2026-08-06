import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import {DraggableBottomSheet} from '../../../shared/components/DraggableBottomSheet';
import {formatEventTime, formatSelectedDateLabel} from '../calendarModel';
import type {CalendarEventSummary, DateKey} from '../types';

interface CalendarEventsSheetProps {
  dateKey: DateKey;
  events: readonly CalendarEventSummary[];
  onClose: () => void;
  onOpenEvent: (eventId: string) => void;
  visible: boolean;
}

export function CalendarEventsSheet({
  dateKey,
  events,
  onClose,
  onOpenEvent,
  visible,
}: CalendarEventsSheetProps) {
  return (
    <DraggableBottomSheet
      accessibilityLabel="선택한 날짜 일정"
      backdropVisible={false}
      collapsedHeight={260}
      initialSnap="collapsed"
      onClose={onClose}
      sheetStyle={styles.sheet}
      visible={visible}
    >
      <View>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>선택한 날짜</Text>
            <Text style={styles.title}>{formatSelectedDateLabel(dateKey)}</Text>
          </View>
          <Pressable
            accessibilityLabel="선택 날짜 일정 닫기"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeButton}
          >
            <MaterialDesignIcons
              color={COLORS.textMuted}
              name="close"
              size={22}
            />
          </Pressable>
        </View>

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialDesignIcons
                color={COLORS.purpleDeep}
                name="calendar-blank-outline"
                size={28}
              />
            </View>
            <Text style={styles.emptyTitle}>등록된 일정이 없어요</Text>
            <Text style={styles.emptyDescription}>
              이 날짜에 새 일정을 추가할 수 있어요.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {events.map(event => (
              <Pressable
                accessibilityHint="일정 상세를 엽니다"
                accessibilityLabel={`${event.title}, ${formatEventTime(event)}`}
                accessibilityRole="button"
                key={event.id}
                onPress={() => onOpenEvent(event.id)}
                style={({pressed}) => [
                  styles.eventRow,
                  pressed && styles.pressedRow,
                ]}
              >
                <View accessibilityElementsHidden style={styles.eventDot} />
                <View style={styles.eventContent}>
                  <Text numberOfLines={1} style={styles.eventTitle}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventTime}>{formatEventTime(event)}</Text>
                </View>
                <MaterialDesignIcons
                  accessibilityElementsHidden
                  color={COLORS.textSubtle}
                  name="chevron-right"
                  size={22}
                />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </DraggableBottomSheet>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    borderRadius: RADII.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptyDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginTop: 6,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderRadius: RADII.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  emptyState: {
    alignItems: 'center',
    minHeight: 190,
    paddingHorizontal: 24,
    paddingTop: 22,
  },
  emptyTitle: {
    color: COLORS.textStrong,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  eventContent: {
    flex: 1,
  },
  eventDot: {
    backgroundColor: COLORS.purpleDeep,
    borderRadius: RADII.pill,
    height: 8,
    width: 8,
  },
  eventRow: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 4,
  },
  eventTime: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  eventTitle: {
    color: COLORS.textStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  eyebrow: {
    color: COLORS.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  headerText: {
    flex: 1,
  },
  list: {
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  pressedRow: {
    backgroundColor: COLORS.lavenderSurface,
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADII.sheet,
    borderTopRightRadius: RADII.sheet,
    maxHeight: '58%',
    minHeight: 270,
    overflow: 'hidden',
  },
  title: {
    color: COLORS.textStrong,
    fontSize: 19,
    fontWeight: '800',
  },
});
