import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import {
  ActivityIndicator,
  Alert,
  Animated,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AppScreenProps } from "../../../app-shell";
import { COLORS, RADII } from "../../../design/tokens";
import { useCalendarGateway } from "../CalendarGatewayContext";
import {
  createCalendarMonth,
  eventsForDate,
  formatMonthLabel,
  getTodayDateKey,
  parseDateKey,
  retainActiveEventParticipants,
  shiftMonth,
  shiftSelectedDateToMonth,
  WEEKDAY_LABELS,
  type YearMonth,
} from "../calendarModel";
import { CalendarEventDetailModal } from "../components/CalendarEventDetailModal";
import { CalendarEventsSheet } from "../components/CalendarEventsSheet";
import {
  CALENDAR_MONTH_HEIGHT,
  CalendarMonthGrid,
} from "../components/CalendarMonthGrid";
import { toErrorMessage, useCalendarData } from "../hooks/useCalendarData";
import { CalendarEventFormScreen } from "./CalendarEventFormScreen";
import type { CalendarEventDetail, CalendarGateway, DateKey } from "../types";

const SWIPE_THRESHOLD = 48;

export interface CalendarScreenProps extends AppScreenProps {
  gateway?: CalendarGateway;
  initialDateKey?: DateKey;
  now?: Date;
}

interface DetailState {
  deleteErrorMessage: string | null;
  deleting: boolean;
  detail: CalendarEventDetail | null;
  errorMessage: string | null;
  eventId: string | null;
  loading: boolean;
  visible: boolean;
}

interface EditorState {
  detail: CalendarEventDetail | null;
}

const CLOSED_DETAIL: DetailState = {
  deleteErrorMessage: null,
  deleting: false,
  detail: null,
  errorMessage: null,
  eventId: null,
  loading: false,
  visible: false,
};

export function CalendarScreen({
  createCalendarEventRequestId,
  currentGroup,
  currentUserId,
  currentUserName = "사용자",
  gateway,
  initialDateKey,
  now,
  onFullscreenChange,
  onHeaderVisibilityChange,
  openCalendarEventId,
  openCalendarEventRequestId,
}: CalendarScreenProps) {
  const contextGateway = useCalendarGateway();
  const resolvedGateway = gateway ?? contextGateway;
  const today = useMemo(() => getTodayDateKey(now), [now]);
  const initialSelectedDate = initialDateKey ?? today;
  const initialParts = parseDateKey(initialSelectedDate);
  const [visibleMonth, setVisibleMonth] = useState<YearMonth>({
    month: initialParts.month,
    year: initialParts.year,
  });
  const [selectedDate, setSelectedDate] =
    useState<DateKey>(initialSelectedDate);
  const [isSheetVisible, setIsSheetVisible] = useState(false);
  const [detailState, setDetailState] = useState<DetailState>(CLOSED_DETAIL);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [isAnimatingMonth, setIsAnimatingMonth] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const calendarViewportHeightRef = useRef(CALENDAR_MONTH_HEIGHT);
  const detailController = useRef<AbortController | null>(null);
  const deleteController = useRef<AbortController | null>(null);
  const lastCreateRequestId = useRef(createCalendarEventRequestId ?? 0);
  const lastOpenEventRequestId = useRef(0);
  // 알림 딥링크로 연 상세는 로드 성공 시 선택 날짜를 이벤트 날짜로 맞춰,
  // 모달을 닫았을 때 해당 날짜의 시트가 열리게 한다.
  const syncDateOnDetailLoadRef = useRef(false);
  const calendarMonth = useMemo(
    () => createCalendarMonth(visibleMonth.year, visibleMonth.month),
    [visibleMonth]
  );
  const { errorMessage, events, members, reload, removeEvent, status } =
    useCalendarData({
      endDate: calendarMonth.endDate,
      gateway: resolvedGateway,
      groupId: currentGroup.id,
      startDate: calendarMonth.startDate,
    });
  const selectedEvents = useMemo(
    () => eventsForDate(events, selectedDate),
    [events, selectedDate]
  );
  const currentMember = useMemo(
    () =>
      currentUserId === undefined
        ? null
        : members.find((member) => member.userId === String(currentUserId)) ??
          null,
    [currentUserId, members]
  );
  const visibleDetail = useMemo(
    () =>
      detailState.detail
        ? retainActiveEventParticipants(detailState.detail, members)
        : null,
    [detailState.detail, members]
  );
  const canManageSelectedEvent = Boolean(
    visibleDetail &&
      currentMember &&
      (currentMember.isManager ||
        currentMember.memberId === visibleDetail.creatorMemberId)
  );

  useEffect(() => {
    detailController.current?.abort();
    deleteController.current?.abort();
    setDetailState(CLOSED_DETAIL);
    setEditorState(null);
    setIsSheetVisible(false);
  }, [currentGroup.id]);

  useEffect(() => {
    const requestId = createCalendarEventRequestId ?? 0;
    if (requestId > 0 && requestId !== lastCreateRequestId.current) {
      lastCreateRequestId.current = requestId;
      setDetailState(CLOSED_DETAIL);
      setIsSheetVisible(false);
      setEditorState({ detail: null });
    }
  }, [createCalendarEventRequestId]);

  useEffect(() => {
    if (!editorState) {
      return;
    }
    onFullscreenChange?.(true);
    onHeaderVisibilityChange?.(false);
    return () => {
      onFullscreenChange?.(false);
      onHeaderVisibilityChange?.(true);
    };
  }, [editorState, onFullscreenChange, onHeaderVisibilityChange]);

  useEffect(
    () => () => {
      detailController.current?.abort();
      deleteController.current?.abort();
    },
    []
  );

  const updateMonth = useCallback(
    (delta: number) => {
      const targetMonth = shiftMonth(visibleMonth, delta);
      setVisibleMonth(targetMonth);
      setSelectedDate((currentDate) =>
        shiftSelectedDateToMonth(currentDate, targetMonth)
      );
    },
    [visibleMonth]
  );

  const animateMonthChange = useCallback(
    (delta: number) => {
      if (isAnimatingMonth) {
        return;
      }
      setIsAnimatingMonth(true);
      const viewportHeight = calendarViewportHeightRef.current;
      const outgoingY = delta > 0 ? -viewportHeight : viewportHeight;
      const incomingY = -outgoingY;

      Animated.timing(translateY, {
        duration: 180,
        toValue: outgoingY,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          translateY.setValue(0);
          setIsAnimatingMonth(false);
          return;
        }
        updateMonth(delta);
        translateY.setValue(incomingY);
        Animated.spring(translateY, {
          damping: 22,
          mass: 0.8,
          stiffness: 220,
          toValue: 0,
          useNativeDriver: true,
        }).start(() => setIsAnimatingMonth(false));
      });
    },
    [isAnimatingMonth, translateY, updateMonth]
  );

  const handleCalendarViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      calendarViewportHeightRef.current = event.nativeEvent.layout.height;
    },
    []
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 12 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          translateY.setValue(gesture.dy * 0.45);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy < -SWIPE_THRESHOLD || gesture.vy < -0.45) {
            animateMonthChange(1);
            return;
          }
          if (gesture.dy > SWIPE_THRESHOLD || gesture.vy > 0.45) {
            animateMonthChange(-1);
            return;
          }
          Animated.spring(translateY, {
            damping: 20,
            stiffness: 240,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            damping: 20,
            stiffness: 240,
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    [animateMonthChange, translateY]
  );

  const handleSelectDate = (dateKey: DateKey) => {
    const selectedParts = parseDateKey(dateKey);
    if (
      selectedParts.year !== visibleMonth.year ||
      selectedParts.month !== visibleMonth.month
    ) {
      setVisibleMonth({
        month: selectedParts.month,
        year: selectedParts.year,
      });
    }
    setSelectedDate(dateKey);
    setIsSheetVisible(true);
  };

  const loadEventDetail = useCallback(
    (eventId: string) => {
      detailController.current?.abort();
      const controller = new AbortController();
      detailController.current = controller;
      // native 팝업이 겹겹이 쌓이지 않도록 시트를 닫고 상세만 연다.
      // Android는 동시에 표시된 Modal마다 별도 dialog를 만들어 잔존 위험이 있다.
      setIsSheetVisible(false);
      setDetailState({
        deleteErrorMessage: null,
        deleting: false,
        detail: null,
        errorMessage: null,
        eventId,
        loading: true,
        visible: true,
      });

      resolvedGateway
        .getEvent(eventId, controller.signal)
        .then((detail) => {
          if (!controller.signal.aborted) {
            if (syncDateOnDetailLoadRef.current) {
              syncDateOnDetailLoadRef.current = false;
              const eventParts = parseDateKey(detail.eventDate);
              setVisibleMonth({
                month: eventParts.month,
                year: eventParts.year,
              });
              setSelectedDate(detail.eventDate);
            }
            setDetailState({
              deleteErrorMessage: null,
              deleting: false,
              detail,
              errorMessage: null,
              eventId,
              loading: false,
              visible: true,
            });
          }
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            // 실패한 딥링크의 플래그가 남으면 다음에 여는 일정이 날짜를 가로챈다.
            syncDateOnDetailLoadRef.current = false;
            setDetailState({
              deleteErrorMessage: null,
              deleting: false,
              detail: null,
              errorMessage: toErrorMessage(error),
              eventId,
              loading: false,
              visible: true,
            });
          }
        });
    },
    [resolvedGateway]
  );

  useEffect(() => {
    const requestId = openCalendarEventRequestId ?? 0;
    if (
      openCalendarEventId &&
      requestId > 0 &&
      requestId !== lastOpenEventRequestId.current
    ) {
      lastOpenEventRequestId.current = requestId;
      syncDateOnDetailLoadRef.current = true;
      loadEventDetail(openCalendarEventId);
    }
  }, [openCalendarEventId, openCalendarEventRequestId, loadEventDetail]);

  const handleCloseDetail = () => {
    if (detailState.deleting) {
      return;
    }
    detailController.current?.abort();
    deleteController.current?.abort();
    setDetailState(CLOSED_DETAIL);
    // 상세는 시트에서만 열리므로 닫으면 선택 날짜 목록으로 복귀한다.
    setIsSheetVisible(true);
  };

  const handleRetryDetail = () => {
    if (detailState.eventId) {
      loadEventDetail(detailState.eventId);
    }
  };

  const handleEditDetail = () => {
    if (visibleDetail && canManageSelectedEvent) {
      setEditorState({ detail: visibleDetail });
      setDetailState(CLOSED_DETAIL);
      setIsSheetVisible(false);
    }
  };

  const deleteSelectedEvent = useCallback(() => {
    const eventId = detailState.detail?.id;
    if (!eventId || detailState.deleting) {
      return;
    }

    const controller = new AbortController();
    deleteController.current?.abort();
    deleteController.current = controller;
    setDetailState((current) => ({
      ...current,
      deleteErrorMessage: null,
      deleting: true,
    }));

    resolvedGateway
      .deleteEvent(eventId, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) {
          removeEvent(eventId);
          setDetailState(CLOSED_DETAIL);
          // 삭제 후에도 선택 날짜 목록으로 복귀한다(스펙: 상세만 닫고 목록에서 제거).
          setIsSheetVisible(true);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setDetailState((current) => ({
            ...current,
            deleteErrorMessage: toErrorMessage(error),
            deleting: false,
          }));
        }
      });
  }, [detailState.deleting, detailState.detail, removeEvent, resolvedGateway]);

  const handleRequestDelete = () => {
    if (!canManageSelectedEvent) {
      return;
    }
    Alert.alert("일정을 삭제할까요?", "삭제한 일정은 다시 복구할 수 없어요.", [
      { style: "cancel", text: "취소" },
      {
        onPress: deleteSelectedEvent,
        style: "destructive",
        text: "삭제",
      },
    ]);
  };

  // 편집 화면은 시트·상세 Modal을 마운트 해제하지 않고 같은 트리에서 전환한다.
  // 표시 중인 Modal을 언마운트하면 native 팝업이 정리되지 않고 겹겹이 남을 수 있다.
  const editorScreen = editorState ? (
    <CalendarEventFormScreen
      currentMember={currentMember}
      currentUserName={currentUserName}
      gateway={resolvedGateway}
      groupId={currentGroup.id}
      initialDate={selectedDate}
      initialDetail={editorState.detail ?? undefined}
      members={members}
      now={now}
      onCancel={() => setEditorState(null)}
      onSaved={() => {
        setEditorState(null);
        setDetailState(CLOSED_DETAIL);
        setIsSheetVisible(true);
        reload();
      }}
    />
  ) : null;

  return (
    <View style={styles.screen}>
      {editorScreen ?? (
        <>
          <View style={styles.monthToolbar}>
            <Text accessibilityRole="header" style={styles.monthTitle}>
              {formatMonthLabel(visibleMonth)}
            </Text>
          </View>

          <View style={styles.weekdays}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Text
                key={label}
                style={[
                  styles.weekday,
                  index === 0 && styles.sunday,
                  index === 6 && styles.saturday,
                ]}
              >
                {label}
              </Text>
            ))}
          </View>

          <View
            accessibilityHint="위로 밀면 다음 달, 아래로 밀면 이전 달로 이동합니다"
            onLayout={handleCalendarViewportLayout}
            style={styles.calendarViewport}
            {...panResponder.panHandlers}
          >
            <Animated.View
              style={[styles.monthAnimation, { transform: [{ translateY }] }]}
            >
              <CalendarMonthGrid
                events={events}
                month={calendarMonth}
                onSelectDate={handleSelectDate}
                selectedDate={selectedDate}
                today={today}
              />
            </Animated.View>

            {status === "loading" ? (
              <View pointerEvents="none" style={styles.loadingOverlay}>
                <ActivityIndicator color={COLORS.purpleDeep} />
              </View>
            ) : null}
          </View>

          {status === "error" ? (
            <View style={styles.messageCard}>
              <MaterialDesignIcons
                color={COLORS.error}
                name="alert-circle-outline"
                size={22}
              />
              <View style={styles.messageContent}>
                <Text style={styles.messageTitle}>
                  일정을 불러오지 못했어요
                </Text>
                <Text style={styles.messageDescription}>{errorMessage}</Text>
              </View>
              <Pressable
                accessibilityLabel="일정 다시 시도"
                accessibilityRole="button"
                onPress={reload}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>재시도</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      )}

      {/* RN Modal은 동시에 하나만 표시한다(F-16). 시트·상세 상호배제를 렌더에서 강제한다. */}
      <CalendarEventsSheet
        dateKey={selectedDate}
        events={selectedEvents}
        onClose={() => setIsSheetVisible(false)}
        onOpenEvent={loadEventDetail}
        visible={
          isSheetVisible && !detailState.visible && editorScreen === null
        }
      />
      <CalendarEventDetailModal
        canManage={canManageSelectedEvent}
        deleteErrorMessage={detailState.deleteErrorMessage}
        deleting={detailState.deleting}
        detail={visibleDetail}
        errorMessage={detailState.errorMessage}
        loading={detailState.loading}
        members={members}
        onClose={handleCloseDetail}
        onDelete={handleRequestDelete}
        onEdit={handleEditDetail}
        onRetry={handleRetryDetail}
        visible={detailState.visible && editorScreen === null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  calendarViewport: {
    flex: 1,
    overflow: "hidden",
  },
  loadingOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  messageCard: {
    alignItems: "center",
    backgroundColor: "#FFF6F5",
    borderRadius: RADII.medium,
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageContent: {
    flex: 1,
  },
  messageDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  messageTitle: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  monthTitle: {
    color: COLORS.textStrong,
    fontSize: 21,
    fontVariant: ["tabular-nums"],
    fontWeight: "800",
  },
  monthToolbar: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  monthAnimation: {
    flex: 1,
  },
  retryButton: {
    alignItems: "center",
    borderColor: "#F2C4C0",
    borderRadius: RADII.pill,
    borderWidth: 1,
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  retryText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: "700",
  },
  saturday: {
    color: "#4B72BC",
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
    overflow: "hidden",
  },
  sunday: {
    color: "#D65B5B",
  },
  weekday: {
    color: COLORS.textMuted,
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  weekdays: {
    alignItems: "center",
    flexDirection: "row",
    height: 30,
  },
});
