import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import { StackActions } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
} from "@react-navigation/native-stack";
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
import { RouteFocusReporter } from "../../../shared/navigation/RouteFocusReporter";
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
import type { CalendarStackParamList } from "../navigationTypes";
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

const CLOSED_DETAIL: DetailState = {
  deleteErrorMessage: null,
  deleting: false,
  detail: null,
  errorMessage: null,
  eventId: null,
  loading: false,
  visible: false,
};

// 캘린더 탭 내부 스택. 일정 편집이 조건부 렌더링 대신 스택 화면으로 열린다.
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();

type CalendarNavigation = NativeStackNavigationProp<CalendarStackParamList>;

// 저장 중에는 스택 pop(하드웨어 백·제스처 포함)을 차단한다. 편집 화면의
// useHardwareBack이 하던 saving 소비를 스택 계층에서 대체한다.
function SavingBackGuard({
  navigation,
  savingRef,
}: {
  navigation: CalendarNavigation;
  savingRef: { current: boolean };
}) {
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (savingRef.current) {
        event.preventDefault();
      }
    });
    return () => {
      // 화면이 사라지면 저장 미러도 초기화해 다음 pop이 막히지 않게 한다.
      savingRef.current = false;
      unsubscribe();
    };
  }, [navigation, savingRef]);

  return null;
}

// 재수화로 스태시가 사라진 수정 폼은 낡은 초기값(신규 작성)으로 저장될 수
// 있어 홈으로 되돌린다 — 상세 데이터를 params에 싣지 않는 대가다.
function ExpiredEditGuard({ navigation }: { navigation: CalendarNavigation }) {
  const hasPopped = useRef(false);

  useEffect(() => {
    if (!hasPopped.current) {
      hasPopped.current = true;
      navigation.goBack();
    }
  }, [navigation]);

  return null;
}

// CalendarHome 딥링크 params 소비자. 루트 화면 params는 재탭 key 리마운트가
// 구 스택 상태를 재수화할 때 그대로 남으므로 소비 직후 setParams로 비운다.
// 비우면 undefined→값 전이가 되어 같은 알림을 두 번 탭해도 다시 발화한다
// (push 화면이던 피드·가입승인 딥링크 선례에는 없던 요구).
function HomeDeepLinkSync({
  navigation,
  onOpenEvent,
  openEventId,
}: {
  navigation: CalendarNavigation;
  onOpenEvent: (eventId: string) => void;
  openEventId: string | undefined;
}) {
  useEffect(() => {
    if (openEventId !== undefined) {
      navigation.setParams({ openEventId: undefined });
      onOpenEvent(openEventId);
    }
  }, [navigation, onOpenEvent, openEventId]);

  return null;
}

export function CalendarScreen({
  currentGroup,
  currentUserId,
  currentUserName = "사용자",
  gateway,
  initialDateKey,
  now,
  onFullscreenChange,
  onHeaderVisibilityChange,
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
  // 편집 화면(스택)의 포커스 미러. 셸 풀스크린 신호와 모달 게이트의 기준이다.
  const [isFormFocused, setIsFormFocused] = useState(false);
  const [isAnimatingMonth, setIsAnimatingMonth] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const calendarViewportHeightRef = useRef(CALENDAR_MONTH_HEIGHT);
  const detailController = useRef<AbortController | null>(null);
  const deleteController = useRef<AbortController | null>(null);
  // 이동 함수가 effect·핸들러에서도 스택을 조작할 수 있게 렌더 중 캡처한다
  // (FeedScreen feedNavRef 관용구).
  const calNavRef = useRef<CalendarNavigation | null>(null);
  // 수정 폼의 초기값 스태시. params에는 eventId만 싣는다(navigationTypes 주석).
  const editorDetailRef = useRef<CalendarEventDetail | null>(null);
  // 저장 진행 미러. SavingBackGuard가 beforeRemove에서 읽는다.
  const savingRef = useRef(false);
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
    setIsSheetVisible(false);
    editorDetailRef.current = null;
    // 그룹이 바뀌면 열려 있던 편집 화면을 홈으로 되돌린다(GroupInfoScreen 선례).
    const stackState = calNavRef.current?.getState();
    const topRoute = stackState?.routes[stackState.index];
    if (topRoute !== undefined && topRoute.name !== "CalendarHome") {
      calNavRef.current?.dispatch(StackActions.popToTop());
    }
  }, [currentGroup.id]);

  useEffect(() => {
    if (!isFormFocused) {
      return;
    }
    // 진입 핸들러가 모달 state를 닫지만, 재수화로 복원된 폼도 같은 정리를
    // 받도록 여기서 한 번 더 닫는다(F-16).
    setDetailState(CLOSED_DETAIL);
    setIsSheetVisible(false);
    onFullscreenChange?.(true);
    onHeaderVisibilityChange?.(false);
    return () => {
      onFullscreenChange?.(false);
      onHeaderVisibilityChange?.(true);
    };
  }, [isFormFocused, onFullscreenChange, onHeaderVisibilityChange]);

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

  // 알림 딥링크(CalendarHome params)로 일정 상세를 연다.
  const handleOpenEventDeepLink = useCallback(
    (eventId: string) => {
      syncDateOnDetailLoadRef.current = true;
      loadEventDetail(eventId);
    },
    [loadEventDetail]
  );

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
      editorDetailRef.current = visibleDetail;
      setDetailState(CLOSED_DETAIL);
      setIsSheetVisible(false);
      calNavRef.current?.navigate("CalendarEventForm", {
        eventId: visibleDetail.id,
        mode: "edit",
      });
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

  return (
    <View style={styles.screen}>
      <CalendarStack.Navigator
        screenOptions={{ animation: "none", headerShown: false }}
      >
        <CalendarStack.Screen name="CalendarHome">
          {({ navigation, route }) => {
            calNavRef.current = navigation;
            return (
              <View style={styles.screen}>
                <HomeDeepLinkSync
                  navigation={navigation}
                  onOpenEvent={handleOpenEventDeepLink}
                  openEventId={route.params?.openEventId}
                />
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
                    style={[
                      styles.monthAnimation,
                      { transform: [{ translateY }] },
                    ]}
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
                      <Text style={styles.messageDescription}>
                        {errorMessage}
                      </Text>
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
              </View>
            );
          }}
        </CalendarStack.Screen>
        <CalendarStack.Screen name="CalendarEventForm">
          {({ navigation, route }) => {
            calNavRef.current = navigation;
            const initialDetail =
              route.params.mode === "edit" ? editorDetailRef.current : null;
            if (route.params.mode === "edit" && initialDetail === null) {
              return <ExpiredEditGuard navigation={navigation} />;
            }
            return (
              <>
                <RouteFocusReporter onFocusChange={setIsFormFocused} />
                <SavingBackGuard
                  navigation={navigation}
                  savingRef={savingRef}
                />
                <CalendarEventFormScreen
                  currentMember={currentMember}
                  currentUserName={currentUserName}
                  gateway={resolvedGateway}
                  groupId={currentGroup.id}
                  initialDate={selectedDate}
                  initialDetail={initialDetail ?? undefined}
                  members={members}
                  now={now}
                  onCancel={() => navigation.goBack()}
                  onSaved={() => {
                    // 저장 성공 시 saving은 true인 채 pop되므로 가드를 먼저 푼다.
                    savingRef.current = false;
                    navigation.goBack();
                    setDetailState(CLOSED_DETAIL);
                    setIsSheetVisible(true);
                    reload();
                  }}
                  onSavingChange={(saving) => {
                    savingRef.current = saving;
                  }}
                />
              </>
            );
          }}
        </CalendarStack.Screen>
      </CalendarStack.Navigator>

      {/* RN Modal은 동시에 하나만 표시한다(F-16). 시트·상세 상호배제를 렌더에서
          강제한다. Modal은 스택의 형제로 두어 편집 화면이 열려도 마운트를
          유지한다 — 표시 중인 Modal을 언마운트하면 native 팝업이 정리되지
          않고 겹겹이 남을 수 있다. */}
      <CalendarEventsSheet
        dateKey={selectedDate}
        events={selectedEvents}
        onClose={() => setIsSheetVisible(false)}
        onOpenEvent={loadEventDetail}
        visible={isSheetVisible && !detailState.visible && !isFormFocused}
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
        visible={detailState.visible && !isFormFocused}
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
