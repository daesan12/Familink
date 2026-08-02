import MaterialDesignIcons from "@react-native-vector-icons/material-design-icons";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import type { AppScreenProps } from "../../../app-shell";
import { COLORS, RADII } from "../../../design/tokens";
import { CallReportDetailModal } from "../components/CallReportDetailModal";
import { CallReportRow } from "../components/CallReportRow";
import { DailyReportCard } from "../components/DailyReportCard";
import {
  ReportCalendarModal,
  type ReportCalendarStatus,
} from "../components/ReportCalendarModal";
import { ReportPageIndicator } from "../components/ReportPageIndicator";
import { DEVELOPMENT_REPORT_PAGES } from "../fixtures/reportFixtures";
import { useCareReceiverReportTargets } from "../hooks/useCareReceiverReportTargets";
import {
  type ReportPageLoadItem,
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
  ReportGateway,
} from "../types";

const EMPTY_REPORT_PAGES: readonly CareReceiverReportPage[] = [];
const EMPTY_REPORT_TARGETS: readonly CareReceiverReportTarget[] = [];
const EMPTY_REPORT_DATES: readonly string[] = [];

interface ReportYearMonth {
  month: number;
  year: number;
}

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
  const callRequestId = useRef(0);

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
    setSelectedDetail(null);
  }, [pageIdentity]);

  const handlePageChange = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (reportItems.length === 0 || width <= 0) {
      return;
    }

    const nextIndex = Math.min(
      reportItems.length - 1,
      Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width))
    );
    setCurrentIndex(nextIndex);
  };

  const handleOpenCall = async (call: CallReportView) => {
    if (!reportGateway) {
      setSelectedDetail({
        call,
        status: call.summary === null ? "generating" : "ready",
      });
      return;
    }

    const requestId = ++callRequestId.current;
    setSelectedDetail({ call, status: "loading" });

    try {
      const report = await reportGateway.getCallReport(call.callSessionId);
      if (requestId !== callRequestId.current) {
        return;
      }

      if (report.status === "generating") {
        setSelectedDetail({ call, status: "generating" });
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
    } catch {
      if (requestId === callRequestId.current) {
        setSelectedDetail({ call, status: "error" });
      }
    }
  };

  const handleCloseDetail = () => {
    callRequestId.current += 1;
    setSelectedDetail(null);
  };

  const handleOpenCalendar = (page: CareReceiverReportPage) => {
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
  };

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

  const handleSelectReportDate = (date: string) => {
    callRequestId.current += 1;
    setSelectedDetail(null);
    setCalendarTarget(null);
    setSelectedReportDate(date);
  };

  const handleRetryDetail = () => {
    if (selectedDetail) {
      handleOpenCall(selectedDetail.call).catch(() => {
        // handleOpenCall이 오류 상태로 변환하므로 추가 처리가 필요하지 않다.
      });
    }
  };

  if (shouldLoadTargets && targetState.status === "loading") {
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

  if (hasRemoteSource && remotePages.status === "loading") {
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
        <Text style={styles.noCareReceiverTitle}>
          리포트를 확인할 피보호자가 없어요
        </Text>
        <Text style={styles.noCareReceiverDescription}>
          현재 그룹에 피보호자가 연결되면 통화 리포트를 확인할 수 있어요.
        </Text>
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
        showsHorizontalScrollIndicator={false}
        testID="care-receiver-report-pager"
      >
        {reportItems.map((item) =>
          item.status === "ready" ? (
            <ReportPage
              isToday={selectedReportDate === reportDate}
              key={item.target.memberId}
              onOpenCalendar={handleOpenCalendar}
              onOpenCall={handleOpenCall}
              page={item.page}
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
      <Text style={styles.loadStateTitle}>{title}</Text>
      <Text style={styles.loadStateDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityLabel={actionAccessibilityLabel}
          accessibilityRole="button"
          onPress={onAction}
          style={styles.retryButton}
        >
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
        </Pressable>
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
  isToday: boolean;
  onOpenCalendar: (page: CareReceiverReportPage) => void;
  onOpenCall: (call: CallReportView) => void;
  page: CareReceiverReportPage;
  width: number;
}

function ReportPage({
  isToday,
  onOpenCalendar,
  onOpenCall,
  page,
  width,
}: ReportPageProps) {
  const pageState = getReportPageState(page);
  const sortedTodayCalls = sortCallsByStartedAt(page.todayCalls);

  return (
    <View style={[styles.page, { width }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{page.displayName} 님의 통화 리포트</Text>
        <Pressable
          accessibilityHint="생성된 일간 리포트 날짜를 월별로 확인합니다"
          accessibilityLabel="리포트 캘린더"
          accessibilityRole="button"
          onPress={() => onOpenCalendar(page)}
          style={styles.calendarButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="calendar-month-outline"
            size={26}
          />
        </Pressable>
      </View>

      {pageState === "empty" ? (
        <EmptyReportState displayName={page.displayName} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          {page.latestDailyReport ? (
            <DailyReportCard report={page.latestDailyReport} />
          ) : (
            <DailyReportPendingCard />
          )}

          <View style={styles.callSection}>
            <Text style={styles.callSectionTitle}>
              {isToday ? "오늘의 통화" : "선택한 날의 통화"}
            </Text>
            {sortedTodayCalls.length > 0 ? (
              <View style={styles.callList}>
                {sortedTodayCalls.map((call) => (
                  <CallReportRow
                    call={call}
                    key={call.callSessionId}
                    onPress={onOpenCall}
                  />
                ))}
              </View>
            ) : (
              <View
                accessibilityLabel="오늘 통화 리포트 없음"
                style={styles.emptyCalls}
              >
                <Text style={styles.emptyCallsText}>
                  {isToday
                    ? "오늘 생성된 통화 리포트가 없어요."
                    : "선택한 날짜에 생성된 통화 리포트가 없어요."}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
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
        <Text style={styles.pendingTitle}>
          아직 일간 리포트가 생성되지 않았어요
        </Text>
        <Text style={styles.pendingDescription}>
          오늘의 통화가 모이면 일간 리포트로 정리해드려요.
        </Text>
      </View>
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
      <Text style={styles.emptyTitle}>
        {displayName} 님께서 아직{"\n"}AI 전화를 사용하시지 않으셨어요
      </Text>
      <Text style={styles.emptyDescription}>
        통화를 마치면 이곳에서 내용을 확인할 수 있어요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  callList: {
    gap: 10,
  },
  callSection: {
    marginTop: 24,
  },
  callSectionTitle: {
    color: COLORS.textStrong,
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 23,
    marginBottom: 12,
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
  header: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 62,
    paddingHorizontal: 20,
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
    paddingBottom: 24,
    paddingHorizontal: 20,
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
  retryButton: {
    alignItems: "center",
    backgroundColor: COLORS.purpleDeep,
    borderRadius: RADII.medium,
    justifyContent: "center",
    marginTop: 20,
    minHeight: 44,
    paddingHorizontal: 22,
  },
  retryButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: "800",
  },
  screen: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  title: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 28,
  },
});
