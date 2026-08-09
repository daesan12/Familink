import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  useNavigation,
  useRoute,
  type RouteProp,
  } from "@react-navigation/native";
import type { ComponentProps } from "react";
import { useCallback,
  useEffect,
  useRef,
  useState } from "react";
import {
  ActivityIndicator,
  Alert,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {AppText} from "../../../shared/components/AppText";

import type { AppScreenProps, MainTabsParamList } from "../../../app-shell";
import { COLORS, RADII } from "../../../design/tokens";
import { RetryButton } from "../../../shared/components/RetryButton";
import { CallReportDetailModal } from "../components/CallReportDetailModal";
import { CallReportRow } from "../components/CallReportRow";
import { DailyReportCard } from "../components/DailyReportCard";
import {
  ReportCalendarModal,
  type ReportCalendarStatus,
} from "../components/ReportCalendarModal";
import { ReportPageIndicator } from "../components/ReportPageIndicator";
import { DEVELOPMENT_REPORT_PAGES } from "../fixtures/reportFixtures";
import { reportCache } from "../reportCache";
import {
  type CareReceiverReportTargetsLoadState,
  useCareReceiverReportTargets,
} from "../hooks/useCareReceiverReportTargets";
import {
  type DailyReportGenerationUiState,
  useDailyReportGeneration,
} from "../hooks/useDailyReportGeneration";
import {
  type ReportPageLoadItem,
  type ReportPagesLoadState,
  useReportPages,
} from "../hooks/useReportPages";
import {
  getReportPageState,
  sortCallsByStartedAt,
} from "../reportPresentation";
import type {
  CallReportDetailState,
  CallReportView,
  CareReceiverReportPage,
  CareReceiverReportTarget,
  CareReceiverReportTargetLoader,
  DailyReportGenerationStatus,
  ReportGateway,
} from "../types";

const EMPTY_REPORT_PAGES: readonly CareReceiverReportPage[] = [];
const EMPTY_REPORT_TARGETS: readonly CareReceiverReportTarget[] = [];
const EMPTY_REPORT_DATES: readonly string[] = [];
const CALL_REPORT_POLL_INTERVAL_MS = 5_000;
const CALL_REPORT_POLL_TIMEOUT_MS = 90_000;
// 통화 카드 좌우 끝을 일간 리포트 카드와 맞추기 위해 페이지 여백·간격을
// 공유한다. 카드 폭은 남는 폭을 3등분해 계산한다.
const PAGE_HORIZONTAL_PADDING = 24;
const CALL_LIST_GAP = 14;
const CALL_LIST_COLUMNS = 3;

// 헤더 캘린더 버튼이 막히는 사유. 아래 화면 조기 반환과 같은 술어로 판정해
// "effect는 열었다고 판단했는데 화면이 조기 반환 중이라 모달이 렌더되지 않는"
// 상태가 생기지 않게 한다.
type CalendarBlockReason = "error" | "loading" | "noCareReceiver";

const CALENDAR_BLOCK_ALERTS: Record<
  CalendarBlockReason,
  { message: string; title: string }
> = {
  error: {
    message: "리포트를 불러오지 못했어요. 화면의 다시 시도를 눌러 주세요.",
    title: "달력을 열 수 없어요",
  },
  loading: {
    message: "잠시 후 달력을 다시 눌러 주세요.",
    title: "리포트를 불러오고 있어요",
  },
  noCareReceiver: {
    message: "현재 그룹에 리포트를 확인할 피보호자가 없어요.",
    title: "달력을 열 수 없어요",
  },
};

// 아래 화면 조기 반환과 판정 순서를 그대로 맞춘다. 순서가 어긋나면 열 수 없는
// 상태를 열 수 있다고 판단하게 된다.
function resolveCalendarBlockReason({
  currentItem,
  hasRemoteSource,
  remotePagesStatus,
  reportItemCount,
  shouldLoadTargets,
  targetStatus,
}: {
  currentItem: ReportPageLoadItem | undefined;
  hasRemoteSource: boolean;
  remotePagesStatus: ReportPagesLoadState["status"];
  reportItemCount: number;
  shouldLoadTargets: boolean;
  targetStatus: CareReceiverReportTargetsLoadState["status"];
}): CalendarBlockReason | null {
  if (shouldLoadTargets) {
    if (targetStatus === "idle" || targetStatus === "loading") {
      return "loading";
    }
    if (targetStatus === "error") {
      return "error";
    }
  }
  if (hasRemoteSource && remotePagesStatus !== "ready") {
    return "loading";
  }
  if (reportItemCount === 0) {
    return "noCareReceiver";
  }
  if (currentItem === undefined) {
    // 피보호자 구성이 줄어든 커밋이라 인덱스가 아직 범위를 벗어나 있다. 화면은
    // 페이저를 그리고 있으므로 "피보호자 없음"이 아니라 곧 보정될 상태다.
    return "loading";
  }
  return currentItem.status === "ready" ? null : currentItem.status;
}

function showCalendarBlockAlert(
  reason: CalendarBlockReason,
  visible: { current: boolean }
) {
  if (visible.current) {
    return;
  }
  visible.current = true;
  const { message, title } = CALENDAR_BLOCK_ALERTS[reason];
  const release = () => {
    visible.current = false;
  };
  // 안드로이드 전용 앱이라 onDismiss가 유효하다. 확인 버튼을 거치지 않고
  // 다이얼로그가 해제·교체되는 경로에서도 플래그를 내려야, 이후 누름이 영구
  // 무반응이 되는 지금 고치는 버그가 되살아나지 않는다.
  Alert.alert(title, message, [{ onPress: release, text: "확인" }], {
    onDismiss: release,
  });
}

function callCardWidth(pageWidth: number): number {
  const available =
    pageWidth -
    PAGE_HORIZONTAL_PADDING * 2 -
    CALL_LIST_GAP * (CALL_LIST_COLUMNS - 1);
  // 남는 폭을 그대로 3등분하면 한 줄 합계가 컨테이너와 같아져, 부동소수점
  // 오차만으로 세 번째 카드가 다음 줄로 밀린다. 내림해 여유를 1px 남긴다.
  return Math.max(0, Math.floor(available / CALL_LIST_COLUMNS));
}

interface ReportYearMonth {
  month: number;
  year: number;
}

// 리포트 탭 route 계약. 테스트의 단독 렌더도 같은 route 이름으로 감싼다.
type ReportTabRoute = RouteProp<MainTabsParamList, "report">;
type ReportTabNavigation = BottomTabNavigationProp<MainTabsParamList, "report">;

export interface ReportScreenProps extends AppScreenProps {
  careReceivers?: readonly CareReceiverReportPage[];
  careReceiverTargets?: readonly CareReceiverReportTarget[];
  careReceiverTargetsLoader?: CareReceiverReportTargetLoader;
  reportDate?: string;
  reportGateway?: ReportGateway;
}

export function ReportScreen({
  careReceivers,
  careReceiverTargets,
  careReceiverTargetsLoader,
  currentGroup,
  reportDate = getKoreaReportDate(),
  reportGateway,
}: ReportScreenProps) {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<ReportTabNavigation>();
  const route = useRoute<ReportTabRoute>();
  const openCalendar = route.params?.openCalendar;
  const openReport = route.params?.openReport;
  const [selectedReportDate, setSelectedReportDate] = useState(reportDate);
  const shouldLoadTargets =
    careReceiverTargets === undefined &&
    careReceiverTargetsLoader !== undefined &&
    reportGateway !== undefined;
  const targetState = useCareReceiverReportTargets({
    enabled: shouldLoadTargets,
    groupId: currentGroup.id,
    loader: careReceiverTargetsLoader,
  });
  const resolvedTargets =
    careReceiverTargets ??
    (targetState.status === "ready"
      ? targetState.targets
      : EMPTY_REPORT_TARGETS);
  const hasRemoteSource =
    reportGateway !== undefined &&
    (careReceiverTargets !== undefined ||
      careReceiverTargetsLoader !== undefined);
  const remotePages = useReportPages({
    enabled:
      hasRemoteSource && (!shouldLoadTargets || targetState.status === "ready"),
    groupId: currentGroup.id,
    reportDate: selectedReportDate,
    reportGateway,
    targets: resolvedTargets,
  });
  const dailyGeneration = useDailyReportGeneration({
    enabled: hasRemoteSource && selectedReportDate === reportDate,
    groupId: currentGroup.id,
    onReady: remotePages.retry,
    reportDate: selectedReportDate,
    reportGateway,
  });
  const localPages =
    careReceivers ??
    (__DEV__ && currentGroup.id === "development-guardian-group"
      ? DEVELOPMENT_REPORT_PAGES
      : EMPTY_REPORT_PAGES);
  const reportItems: readonly ReportPageLoadItem[] =
    hasRemoteSource && remotePages.status === "ready"
      ? remotePages.items
      : localPages.map((page) => ({
          page,
          status: "ready" as const,
          target: {
            displayName: page.displayName,
            memberId: page.memberId,
          },
        }));
  const pageIdentity = `${currentGroup.id}:${reportItems
    .map((item) => item.target.memberId)
    .join(",")}`;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDetail, setSelectedDetail] =
    useState<CallReportDetailState | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<{
    localReportDates: readonly string[];
    memberId: string;
  } | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    parseReportYearMonth(reportDate)
  );
  const [calendarDatesByMonth, setCalendarDatesByMonth] = useState<
    Record<string, readonly string[]>
  >({});
  const [calendarStatusByMonth, setCalendarStatusByMonth] = useState<
    Record<string, ReportCalendarStatus>
  >({});
  const calendarLoadGeneration = useRef(0);
  const calendarRequests = useRef(new Map<string, number>());
  // 캘린더를 열 수 없다는 안내가 떠 있는 동안인지. 연타로 다이얼로그가 쌓이는
  // 것을 막는다.
  const calendarAlertVisible = useRef(false);
  const callRequestId = useRef(0);
  const pagerRef = useRef<ScrollView>(null);
  // 첫 진입 페이지를 이미 정한 피보호자 구성. 같은 구성에서는 다시 옮기지 않아
  // 사용자가 넘긴 페이지를 되돌리지 않는다.
  const initialPageAppliedFor = useRef<string | null>(null);
  // 알림 딥링크로 진입할 멤버·통화. 목적지 날짜의 페이지 로드가 끝난 뒤 적용한다.
  // state여야 새 딥링크 소비가 적용 effect를 다시 실행한다.
  const [pendingDeepLink, setPendingDeepLink] = useState<{
    callSessionId?: string;
    memberId: string;
    reportDate: string;
  } | null>(null);
  const callPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callDeadlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCallPollTimer = useCallback(() => {
    if (callPollTimer.current !== null) {
      clearTimeout(callPollTimer.current);
      callPollTimer.current = null;
    }
  }, []);

  const clearCallDeadlineTimer = useCallback(() => {
    if (callDeadlineTimer.current !== null) {
      clearTimeout(callDeadlineTimer.current);
      callDeadlineTimer.current = null;
    }
  }, []);

  const clearCallReportTimers = useCallback(() => {
    clearCallPollTimer();
    clearCallDeadlineTimer();
  }, [clearCallDeadlineTimer, clearCallPollTimer]);

  const invalidateCallDetail = useCallback(() => {
    callRequestId.current += 1;
    clearCallReportTimers();
  }, [clearCallReportTimers]);

  const expireCallReportPolling = useCallback(
    (call: CallReportView, requestId: number) => {
      if (requestId !== callRequestId.current) {
        return;
      }
      callRequestId.current += 1;
      clearCallReportTimers();
      setSelectedDetail({ call, status: "delayed" });
    },
    [clearCallReportTimers]
  );

  const calendarMonthKey = calendarTarget
    ? createCalendarMonthKey(
        currentGroup.id,
        calendarTarget.memberId,
        calendarMonth.year,
        calendarMonth.month
      )
    : null;
  const calendarDates = !calendarTarget
    ? EMPTY_REPORT_DATES
    : reportGateway && calendarMonthKey
    ? calendarDatesByMonth[calendarMonthKey] ?? EMPTY_REPORT_DATES
    : filterReportDatesByMonth(
        calendarTarget.localReportDates,
        calendarMonth.year,
        calendarMonth.month
      );
  const calendarStatus =
    reportGateway && calendarMonthKey
      ? calendarStatusByMonth[calendarMonthKey] ?? "loading"
      : "ready";

  useEffect(() => {
    setSelectedReportDate(reportDate);
    setCalendarTarget(null);
    calendarLoadGeneration.current += 1;
    calendarRequests.current.clear();
    setCalendarDatesByMonth({});
    setCalendarStatusByMonth({});
  }, [currentGroup.id, reportDate]);

  useEffect(() => {
    if (!calendarTarget) {
      return;
    }

    if (!reportGateway) {
      return;
    }

    const generation = calendarLoadGeneration.current;
    const loadMonth = (targetMonth: ReportYearMonth) => {
      const key = createCalendarMonthKey(
        currentGroup.id,
        calendarTarget.memberId,
        targetMonth.year,
        targetMonth.month
      );
      if (
        calendarDatesByMonth[key] !== undefined ||
        calendarStatusByMonth[key] === "error" ||
        calendarRequests.current.has(key)
      ) {
        return;
      }

      calendarRequests.current.set(key, generation);
      setCalendarStatusByMonth((current) => ({
        ...current,
        [key]: "loading",
      }));

      reportGateway
        .getReportDates(
          currentGroup.id,
          calendarTarget.memberId,
          targetMonth.year,
          targetMonth.month
        )
        .then((calendar) => {
          if (calendarLoadGeneration.current !== generation) {
            return;
          }
          setCalendarDatesByMonth((current) => ({
            ...current,
            [key]: calendar.reportDates,
          }));
          setCalendarStatusByMonth((current) => ({
            ...current,
            [key]: "ready",
          }));
        })
        .catch(() => {
          if (calendarLoadGeneration.current === generation) {
            setCalendarStatusByMonth((current) => ({
              ...current,
              [key]: "error",
            }));
          }
        })
        .finally(() => {
          if (calendarRequests.current.get(key) === generation) {
            calendarRequests.current.delete(key);
          }
        });
    };

    loadMonth(calendarMonth);
    loadMonth(moveReportYearMonth(calendarMonth, -1));
    loadMonth(moveReportYearMonth(calendarMonth, 1));
  }, [
    calendarDatesByMonth,
    calendarMonth,
    calendarStatusByMonth,
    calendarTarget,
    currentGroup.id,
    reportGateway,
  ]);

  useEffect(() => {
    setCurrentIndex(0);
    callRequestId.current += 1;
    if (callPollTimer.current !== null) {
      clearTimeout(callPollTimer.current);
      callPollTimer.current = null;
    }
    if (callDeadlineTimer.current !== null) {
      clearTimeout(callDeadlineTimer.current);
      callDeadlineTimer.current = null;
    }
    setSelectedDetail(null);
  }, [pageIdentity]);

  useEffect(
    () => () => {
      callRequestId.current += 1;
      if (callPollTimer.current !== null) {
        clearTimeout(callPollTimer.current);
        callPollTimer.current = null;
      }
      if (callDeadlineTimer.current !== null) {
        clearTimeout(callDeadlineTimer.current);
        callDeadlineTimer.current = null;
      }
    },
    []
  );

  const handlePageChange = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (reportItems.length === 0 || width <= 0) {
      return;
    }

    const nextIndex = Math.min(
      reportItems.length - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width))
    );
    if (nextIndex !== currentIndex) {
      invalidateCallDetail();
      setSelectedDetail(null);
    }
    setCurrentIndex(nextIndex);
  };

  const handleOpenCall = useCallback(
    async (call: CallReportView) => {
      clearCallReportTimers();
      if (!reportGateway) {
        setSelectedDetail({
          call,
          status: !call.reportAvailable
            ? "unavailable"
            : call.summary === null
            ? "generating"
            : "ready",
        });
        return;
      }
      const gateway = reportGateway;

      // 준비된 건별 리포트는 서버가 재생성하지 않으므로 조회 없이 그대로 쓴다.
      // 이전 조회가 남아 있으면 무효화해 늦게 온 응답이 덮어쓰지 못하게 한다.
      // 준비 전 상태는 캐시하지 않으므로 상태 다시 확인은 항상 서버로 간다.
      const cachedReport = reportCache.getCallReport(call.callSessionId);
      if (cachedReport) {
        invalidateCallDetail();
        setSelectedDetail({
          call: {
            ...call,
            guardianMessage: cachedReport.guardianMessage,
            summary: cachedReport.summary,
          },
          status: "ready",
        });
        return;
      }

      const requestId = ++callRequestId.current;
      const cacheGeneration = reportCache.generation();
      const pollingStartedAt = Date.now();
      setSelectedDetail({ call, status: "loading" });
      scheduleCallReportDeadline();

      function scheduleCallReportStatus() {
        clearCallPollTimer();
        if (requestId !== callRequestId.current) {
          return;
        }
        const elapsedMs = Date.now() - pollingStartedAt;
        if (elapsedMs >= CALL_REPORT_POLL_TIMEOUT_MS) {
          expireCallReportPolling(call, requestId);
          return;
        }

        callPollTimer.current = setTimeout(() => {
          callPollTimer.current = null;
          loadCallReportStatus().catch(() => {
            // loadCallReportStatus가 오류 상태로 변환하므로 추가 처리가 필요하지 않다.
          });
        }, Math.min(
          CALL_REPORT_POLL_INTERVAL_MS,
          CALL_REPORT_POLL_TIMEOUT_MS - elapsedMs
        ));
      }

      function scheduleCallReportDeadline() {
        clearCallDeadlineTimer();
        const remainingMs = Math.max(
          0,
          CALL_REPORT_POLL_TIMEOUT_MS - (Date.now() - pollingStartedAt)
        );
        callDeadlineTimer.current = setTimeout(() => {
          callDeadlineTimer.current = null;
          expireCallReportPolling(call, requestId);
        }, remainingMs);
      }

      async function loadCallReportStatus() {
        if (requestId !== callRequestId.current) {
          return;
        }

        try {
          const reportStatus = await gateway.getCallReportStatus(
            call.callSessionId
          );
          if (requestId !== callRequestId.current) {
            return;
          }

          if (reportStatus.status === "ready") {
            await loadReadyCallReport();
          } else if (reportStatus.status === "generating") {
            setSelectedDetail({ call, status: "generating" });
            scheduleCallReportStatus();
          } else if (reportStatus.status === "failed") {
            clearCallReportTimers();
            setSelectedDetail({ call, status: "failed" });
          } else {
            clearCallReportTimers();
            setSelectedDetail({ call, status: "unavailable" });
          }
        } catch {
          if (requestId === callRequestId.current) {
            clearCallReportTimers();
            setSelectedDetail({ call, status: "error" });
          }
        }
      }

      async function loadReadyCallReport() {
        if (requestId !== callRequestId.current) {
          return;
        }

        try {
          const report = await gateway.getCallReport(call.callSessionId);
          if (report.status === "ready") {
            // 준비된 리포트는 불변이라 조회가 무효화된 뒤 도착해도 캐시에 남긴다.
            reportCache.setCallReport(report, cacheGeneration);
          }
          if (requestId !== callRequestId.current) {
            return;
          }

          if (report.status === "generating") {
            setSelectedDetail({ call, status: "generating" });
            scheduleCallReportStatus();
            return;
          }

          setSelectedDetail({
            call: {
              ...call,
              guardianMessage: report.guardianMessage,
              summary: report.summary,
            },
            status: "ready",
          });
          clearCallReportTimers();
        } catch {
          if (requestId === callRequestId.current) {
            clearCallReportTimers();
            setSelectedDetail({ call, status: "error" });
          }
        }
      }

      await loadCallReportStatus();
    },
    [
      clearCallDeadlineTimer,
      clearCallPollTimer,
      clearCallReportTimers,
      expireCallReportPolling,
      invalidateCallDetail,
      reportGateway,
    ]
  );

  const handleCloseDetail = () => {
    invalidateCallDetail();
    setSelectedDetail(null);
  };

  const handleOpenCalendar = useCallback(
    (page: CareReceiverReportPage) => {
      const displayedDate =
        page.latestDailyReport?.reportDate ?? selectedReportDate;
      if (page.reportCalendar) {
        const reportCalendarMonth = parseReportYearMonth(
          `${page.reportCalendar.yearMonth}-01`
        );
        const key = createCalendarMonthKey(
          currentGroup.id,
          page.memberId,
          reportCalendarMonth.year,
          reportCalendarMonth.month
        );
        setCalendarDatesByMonth((current) => ({
          ...current,
          [key]: page.reportCalendar?.reportDates ?? EMPTY_REPORT_DATES,
        }));
        setCalendarStatusByMonth((current) => ({
          ...current,
          [key]: "ready",
        }));
      }
      setCalendarMonth(parseReportYearMonth(displayedDate));
      setCalendarTarget({
        localReportDates: page.latestDailyReport
          ? [page.latestDailyReport.reportDate]
          : [],
        memberId: page.memberId,
      });
    },
    [currentGroup.id, selectedReportDate]
  );

  const handleMoveCalendarMonth = (offset: number) => {
    setCalendarMonth((current) => moveReportYearMonth(current, offset));
  };

  const handleRetryCalendar = () => {
    if (!calendarMonthKey) {
      return;
    }
    setCalendarStatusByMonth((current) => ({
      ...current,
      [calendarMonthKey]: "loading",
    }));
  };

  const handleSelectReportDate = useCallback(
    (date: string) => {
      invalidateCallDetail();
      setSelectedDetail(null);
      setCalendarTarget(null);
      setSelectedReportDate(date);
    },
    [invalidateCallDetail]
  );

  const handleRetryDetail = () => {
    if (selectedDetail) {
      handleOpenCall(selectedDetail.call).catch(() => {
        // handleOpenCall이 오류 상태로 변환하므로 추가 처리가 필요하지 않다.
      });
    }
  };

  // 알림 딥링크(리포트 탭 route params)를 소비한다. 탭 route params는 재탭
  // 리마운트 뒤에도 남아 있으므로 소비 직후 setParams로 비운다. 비우면
  // undefined→값 전이가 되어 같은 알림을 두 번 탭해도 다시 발화한다.
  useEffect(() => {
    if (openReport === undefined) {
      return;
    }
    navigation.setParams({ openReport: undefined });
    setPendingDeepLink({
      ...(openReport.callSessionId === undefined
        ? {}
        : { callSessionId: openReport.callSessionId }),
      memberId: openReport.memberId,
      reportDate: openReport.reportDate,
    });
    handleSelectReportDate(openReport.reportDate);
  }, [handleSelectReportDate, navigation, openReport]);

  const calendarBlockReason = resolveCalendarBlockReason({
    currentItem: reportItems[currentIndex],
    hasRemoteSource,
    remotePagesStatus: remotePages.status,
    reportItemCount: reportItems.length,
    shouldLoadTargets,
    targetStatus: targetState.status,
  });

  // 헤더 캘린더 요청은 게이트 통과 여부와 무관하게 즉시 소비한다. 남겨두면
  // (1) 나중에 리포트가 준비되는 순간 누르지 않은 달력이 저절로 열리고,
  // (2) 남아 있는 동안 다시 눌러도 같은 게이트에 막혀 계속 무반응이 된다.
  // 열 수 없으면 사유에 맞는 안내를 띄워 "아무 반응 없음" 구간을 없앤다.
  useEffect(() => {
    if (openCalendar !== true) {
      return;
    }

    navigation.setParams({ openCalendar: undefined });

    if (calendarBlockReason !== null) {
      showCalendarBlockAlert(calendarBlockReason, calendarAlertVisible);
      return;
    }

    const currentItem = reportItems[currentIndex];
    if (!currentItem || currentItem.status !== "ready") {
      // 위 사유 판정과 어긋난 경우. 조용히 반환하면 아무 반응 없는 구간이
      // 되살아나므로 로딩으로 간주해 안내한다.
      showCalendarBlockAlert("loading", calendarAlertVisible);
      return;
    }

    handleOpenCalendar(currentItem.page);
  }, [
    calendarBlockReason,
    currentIndex,
    handleOpenCalendar,
    navigation,
    openCalendar,
    reportItems,
  ]);

  // 첫 진입은 가입 순서가 아니라 통화 리포트가 있는 피보호자부터 보여준다.
  // 딥링크가 있으면 그쪽이 우선이라 건드리지 않는다.
  useEffect(() => {
    if (
      initialPageAppliedFor.current === pageIdentity ||
      pendingDeepLink ||
      reportItems.length === 0 ||
      width <= 0 ||
      (hasRemoteSource && remotePages.status !== "ready")
    ) {
      return;
    }

    initialPageAppliedFor.current = pageIdentity;
    const index = reportItems.findIndex(
      (item) => item.status === "ready" && item.page.todayCalls.length > 0
    );
    // 아무도 없으면(-1) 첫 페이지를 그대로 두고, 이미 첫 페이지면(0) 옮길 필요가 없다.
    if (index <= 0) {
      return;
    }
    pagerRef.current?.scrollTo({ animated: false, x: index * width });
    setCurrentIndex(index);
  }, [
    hasRemoteSource,
    pageIdentity,
    pendingDeepLink,
    remotePages.status,
    reportItems,
    width,
  ]);

  // 페이지 로드가 끝나면 딥링크 대상 멤버로 페이저를 이동하고,
  // callSessionId가 지정된 경우 해당 통화 상세까지 연다.
  useEffect(() => {
    if (!pendingDeepLink || reportItems.length === 0 || width <= 0) {
      return;
    }
    // 날짜 변경 직후의 effect 실행은 아직 이전 날짜의 페이지를 들고 있으므로
    // 선택 날짜가 목적지 날짜로 반영된 뒤에만 적용한다.
    if (pendingDeepLink.reportDate !== selectedReportDate) {
      return;
    }
    if (hasRemoteSource && remotePages.status !== "ready") {
      return;
    }
    const index = reportItems.findIndex(
      (item) => item.target.memberId === pendingDeepLink.memberId
    );
    if (index < 0) {
      setPendingDeepLink(null);
      return;
    }
    const item = reportItems[index];
    if (item.status === "loading") {
      return;
    }
    setPendingDeepLink(null);
    pagerRef.current?.scrollTo({ animated: false, x: index * width });
    setCurrentIndex(index);
    if (
      item.status === "ready" &&
      pendingDeepLink.callSessionId !== undefined
    ) {
      const call = item.page.todayCalls.find(
        (todayCall) => todayCall.callSessionId === pendingDeepLink.callSessionId
      );
      if (call) {
        handleOpenCall(call).catch(() => {
          // handleOpenCall이 오류 상태로 변환하므로 추가 처리가 필요하지 않다.
        });
      }
    }
    // 이미 같은 날짜를 보고 있으면 페이지 재로딩이 없지만 pendingDeepLink가
    // state라 새 딥링크 소비가 이 effect를 다시 실행한다. state 초기화로
    // 1회만 적용한다.
  }, [
    reportItems,
    width,
    hasRemoteSource,
    remotePages.status,
    handleOpenCall,
    pendingDeepLink,
    selectedReportDate,
  ]);

  if (
    shouldLoadTargets &&
    (targetState.status === "idle" || targetState.status === "loading")
  ) {
    return (
      <ReportLoadState
        description="현재 그룹의 피보호자를 확인하고 있어요."
        icon="account-search-outline"
        title="피보호자 목록을 불러오고 있어요"
      />
    );
  }

  if (shouldLoadTargets && targetState.status === "error") {
    return (
      <ReportLoadState
        actionLabel="다시 시도"
        description={targetState.message}
        icon="alert-circle-outline"
        onAction={targetState.retry}
        title="피보호자 조회에 실패했어요"
      />
    );
  }

  if (hasRemoteSource && remotePages.status !== "ready") {
    return (
      <ReportLoadState
        description="피보호자의 일간·건별 리포트를 확인하고 있어요."
        icon="clock-outline"
        title="리포트를 불러오고 있어요"
      />
    );
  }

  if (reportItems.length === 0) {
    return (
      <View
        accessibilityLabel="조회할 피보호자가 없는 리포트"
        style={styles.noCareReceiver}
      >
        <AppText style={styles.noCareReceiverTitle}>
          리포트를 확인할 피보호자가 없어요
        </AppText>
        <AppText style={styles.noCareReceiverDescription}>
          현재 그룹에 피보호자가 연결되면 통화 리포트를 확인할 수 있어요.
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        accessibilityLabel="피보호자별 통화 리포트"
        decelerationRate="fast"
        horizontal
        key={pageIdentity}
        onMomentumScrollEnd={handlePageChange}
        pagingEnabled
        ref={pagerRef}
        showsHorizontalScrollIndicator={false}
        testID="care-receiver-report-pager"
      >
        {reportItems.map((item) =>
          item.status === "ready" ? (
            <ReportPage
              generationState={dailyGeneration.states[item.target.memberId]}
              isToday={selectedReportDate === reportDate}
              key={item.target.memberId}
              onGenerateDailyReport={
                reportGateway ? dailyGeneration.request : undefined
              }
              onOpenCall={handleOpenCall}
              page={item.page}
              reportDate={selectedReportDate}
              width={width}
            />
          ) : (
            <ReportPageRequestState
              item={item}
              key={item.target.memberId}
              onRetry={remotePages.retry}
              width={width}
            />
          )
        )}
      </ScrollView>

      <ReportPageIndicator
        currentIndex={currentIndex}
        pages={reportItems.map((item) => item.target)}
      />

      <CallReportDetailModal
        detail={selectedDetail}
        onClose={handleCloseDetail}
        onRetry={handleRetryDetail}
      />

      <ReportCalendarModal
        month={calendarMonth.month}
        onClose={() => setCalendarTarget(null)}
        onNextMonth={() => handleMoveCalendarMonth(1)}
        onPreviousMonth={() => handleMoveCalendarMonth(-1)}
        onRetry={handleRetryCalendar}
        onSelectDate={handleSelectReportDate}
        reportDates={calendarDates}
        selectedDate={selectedReportDate}
        status={calendarStatus}
        visible={calendarTarget !== null}
        year={calendarMonth.year}
      />
    </View>
  );
}

interface ReportLoadStateProps {
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  description: string;
  icon: ComponentProps<typeof MaterialDesignIcons>["name"];
  onAction?: () => void;
  title: string;
}

function ReportLoadState({
  actionLabel,
  actionAccessibilityLabel,
  description,
  icon,
  onAction,
  title,
}: ReportLoadStateProps) {
  return (
    <View accessibilityLabel={title} style={styles.loadState}>
      <MaterialDesignIcons color={COLORS.purpleDeep} name={icon} size={34} />
      <AppText style={styles.loadStateTitle}>{title}</AppText>
      <AppText style={styles.loadStateDescription}>{description}</AppText>
      {actionLabel && onAction ? (
        <View style={styles.retryButtonWrap}>
          <RetryButton
            accessibilityLabel={actionAccessibilityLabel}
            label={actionLabel}
            onPress={onAction}
          />
        </View>
      ) : null}
    </View>
  );
}

function ReportPageRequestState({
  item,
  onRetry,
  width,
}: {
  item: Exclude<ReportPageLoadItem, { status: "ready" }>;
  onRetry: (memberId: string) => void;
  width: number;
}) {
  const isError = item.status === "error";

  return (
    <View style={[styles.page, { width }]}>
      <ReportLoadState
        actionAccessibilityLabel={`${item.target.displayName} 님 리포트 다시 시도`}
        actionLabel={isError ? "이 리포트 다시 시도" : undefined}
        description={
          isError
            ? `${item.message} 다른 피보호자의 리포트는 계속 확인할 수 있어요.`
            : "다른 피보호자의 리포트는 그대로 유지돼요."
        }
        icon={isError ? "alert-circle-outline" : "clock-outline"}
        onAction={isError ? () => onRetry(item.target.memberId) : undefined}
        title={
          isError
            ? `${item.target.displayName} 님의 리포트 조회에 실패했어요`
            : `${item.target.displayName} 님의 리포트를 다시 불러오고 있어요`
        }
      />
    </View>
  );
}

function getKoreaReportDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day
    ? `${year}-${month}-${day}`
    : now.toISOString().slice(0, 10);
}

interface ReportPageProps {
  generationState?: DailyReportGenerationUiState;
  isToday: boolean;
  onGenerateDailyReport?: (memberId: string) => void;
  onOpenCall: (call: CallReportView) => void;
  page: CareReceiverReportPage;
  reportDate: string;
  width: number;
}

function ReportPage({
  generationState,
  isToday,
  onGenerateDailyReport,
  onOpenCall,
  page,
  reportDate,
  width,
}: ReportPageProps) {
  const pageState = getReportPageState(page);
  const sortedTodayCalls = sortCallsByStartedAt(page.todayCalls);
  const generationStatus =
    generationState?.generationStatus ?? page.selectedDateGenerationStatus;
  const shouldShowReportContent =
    pageState !== "empty" || (isToday && onGenerateDailyReport !== undefined);

  return (
    <View style={[styles.page, { width }]}>
      {shouldShowReportContent ? (
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <AppText style={styles.reportHeading}>
            {`${formatReportHeadingDate(
              page.latestDailyReport?.reportDate ?? reportDate
            )},\n${page.displayName}님과의 대화`}
          </AppText>

          {page.latestDailyReport ? (
            <DailyReportCard report={page.latestDailyReport} />
          ) : (
            <DailyReportPendingCard />
          )}

          {isToday && onGenerateDailyReport ? (
            <DailyReportGenerationControl
              message={generationState?.message ?? null}
              onPress={() => onGenerateDailyReport(page.memberId)}
              status={generationStatus}
            />
          ) : null}

          <View style={styles.callSection}>
            <AppText style={styles.callSectionTitle}>
              {isToday ? "오늘의 통화" : "선택한 날의 통화"}
            </AppText>
            {sortedTodayCalls.length > 0 ? (
              // 한 줄에 3건씩 채우고 넘치면 아래 줄로 내린다. 가로 ScrollView를
              // 쓰면 바깥 피보호자 페이저(역시 가로)에 제스처를 뺏겨 스크롤되지
              // 않으므로, 세로로 쌓아 페이지 스크롤에 맡긴다.
              <View style={styles.callList} testID="call-report-list">
                {sortedTodayCalls.map((call) => (
                  <CallReportRow
                    call={call}
                    key={call.callSessionId}
                    onPress={onOpenCall}
                    width={callCardWidth(width)}
                  />
                ))}
              </View>
            ) : (
              <View
                accessibilityLabel="오늘 통화 리포트 없음"
                style={styles.emptyCalls}
              >
                <AppText style={styles.emptyCallsText}>
                  {isToday
                    ? "오늘 생성된 통화 리포트가 없어요."
                    : "선택한 날짜에 생성된 통화 리포트가 없어요."}
                </AppText>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <EmptyReportState displayName={page.displayName} />
      )}
    </View>
  );
}

function formatReportHeadingDate(reportDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(reportDate);
  if (!match) {
    return reportDate;
  }

  const [, year, month, day] = match;
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "long",
  }).format(new Date(`${year}-${month}-${day}T12:00:00+09:00`));

  return `${Number(month)}월 ${Number(day)}일 ${weekday}`;
}

function parseReportYearMonth(reportDate: string): ReportYearMonth {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(reportDate);
  if (!match) {
    throw new Error("reportDate must use YYYY-MM-DD format.");
  }

  return { month: Number(match[2]), year: Number(match[1]) };
}

function moveReportYearMonth(
  current: ReportYearMonth,
  offset: number
): ReportYearMonth {
  const date = new Date(Date.UTC(current.year, current.month - 1 + offset, 1));
  return {
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function createCalendarMonthKey(
  groupId: string,
  memberId: string,
  year: number,
  month: number
): string {
  return `${groupId}:${memberId}:${year}-${String(month).padStart(2, "0")}`;
}

function filterReportDatesByMonth(
  reportDates: readonly string[],
  year: number,
  month: number
): readonly string[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return reportDates.filter((date) => date.startsWith(prefix));
}

function DailyReportPendingCard() {
  return (
    <View accessibilityLabel="일간 리포트 준비 중" style={styles.pendingCard}>
      <View style={styles.pendingIcon}>
        <MaterialDesignIcons
          color={COLORS.purpleDeep}
          name="clock-outline"
          size={24}
        />
      </View>
      <View style={styles.pendingCopy}>
        <AppText style={styles.pendingTitle}>
          아직 일간 리포트가 생성되지 않았어요
        </AppText>
        <AppText style={styles.pendingDescription}>
          오늘의 통화가 모이면 일간 리포트로 정리해드려요.
        </AppText>
      </View>
    </View>
  );
}

function DailyReportGenerationControl({
  message,
  onPress,
  status,
}: {
  message: string | null;
  onPress: () => void;
  status: DailyReportGenerationStatus;
}) {
  if (status === "ready") {
    return null;
  }

  const isAvailable = status === "available";
  const isGenerating = status === "generating";
  if (!isAvailable && !isGenerating) {
    return null;
  }

  const label = isAvailable
    ? "일간 리포트 생성"
    : "일간 리포트 생성 중…";

  return (
    <View style={styles.generationControl}>
      <Pressable
        accessibilityHint={
          isAvailable
            ? "준비된 오늘의 건별 리포트로 일간 리포트를 생성합니다"
            : undefined
        }
        accessibilityLabel={label}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isAvailable }}
        disabled={!isAvailable}
        onPress={onPress}
        style={[
          styles.generationButton,
          !isAvailable ? styles.generationButtonDisabled : null,
        ]}
      >
        {isGenerating ? (
          <ActivityIndicator color={COLORS.textMuted} size="small" />
        ) : (
          <MaterialDesignIcons
            color={isAvailable ? COLORS.background : COLORS.textMuted}
            name={isAvailable ? "file-document-plus-outline" : "clock-outline"}
            size={20}
          />
        )}
        <AppText
          style={[
            styles.generationButtonText,
            !isAvailable ? styles.generationButtonTextDisabled : null,
          ]}
        >
          {label}
        </AppText>
      </Pressable>
      {message ? (
        <AppText accessibilityLiveRegion="polite" style={styles.generationMessage}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

function EmptyReportState({ displayName }: { displayName: string }) {
  return (
    <View accessibilityLabel="통화 리포트 없음" style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <MaterialDesignIcons
          color={COLORS.purpleDeep}
          name="message-text-clock-outline"
          size={34}
        />
      </View>
      <AppText style={styles.emptyTitle}>
        {displayName} 님께서 아직{"\n"}AI 전화를 사용하시지 않으셨어요
      </AppText>
      <AppText style={styles.emptyDescription}>
        통화를 마치면 이곳에서 내용을 확인할 수 있어요.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  callList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: CALL_LIST_GAP,
    paddingBottom: 8,
  },
  callSection: {
    marginTop: 42,
  },
  callSectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25,
    marginBottom: 16,
    marginLeft: 8,
  },
  emptyCalls: {
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderCurve: "continuous",
    borderRadius: RADII.medium,
    justifyContent: "center",
    minHeight: 84,
    padding: 18,
  },
  emptyCallsText: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  emptyDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: "continuous",
    borderRadius: RADII.pill,
    height: 68,
    justifyContent: "center",
    marginBottom: 20,
    width: 68,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: 56,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: COLORS.textStrong,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 29,
    textAlign: "center",
  },
  generationButton: {
    alignItems: "center",
    backgroundColor: COLORS.purpleDeep,
    borderCurve: "continuous",
    borderRadius: RADII.medium,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: 18,
  },
  generationButtonDisabled: {
    backgroundColor: COLORS.surface,
  },
  generationButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 21,
  },
  generationButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  generationControl: {
    gap: 8,
    marginTop: 12,
  },
  generationMessage: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  noCareReceiver: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  noCareReceiverDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
  noCareReceiverTitle: {
    color: COLORS.textStrong,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 27,
    textAlign: "center",
  },
  loadState: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadStateDescription: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: "center",
  },
  loadStateTitle: {
    color: COLORS.textStrong,
    fontSize: 19,
    fontWeight: "800",
    lineHeight: 27,
    marginTop: 16,
    textAlign: "center",
  },
  page: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  pageContent: {
    paddingBottom: 28,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING,
    paddingTop: 16,
  },
  pendingCard: {
    alignItems: "center",
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: "continuous",
    borderRadius: RADII.sheet,
    flexDirection: "row",
    gap: 13,
    minHeight: 106,
    padding: 18,
  },
  pendingCopy: {
    flex: 1,
  },
  pendingDescription: {
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },
  pendingIcon: {
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderCurve: "continuous",
    borderRadius: RADII.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  pendingTitle: {
    color: COLORS.textStrong,
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 22,
  },
  retryButtonWrap: {
    marginTop: 20,
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  reportHeading: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.4,
    lineHeight: 36,
    marginBottom: 26,
    marginLeft: 8,
  },
});
