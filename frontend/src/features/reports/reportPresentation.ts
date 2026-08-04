import type {
  CallReportView,
  CareReceiverReportPage,
  CareReceiverReportTarget,
  DailyReportResult,
  ReportCalendar,
  ReportEmotionCategory,
  ReportEmotionPresentation,
  ReportPageState,
} from "./types";

const EMOTION_PRESENTATIONS: Record<
  ReportEmotionCategory,
  ReportEmotionPresentation
> = {
  ANGER: { icon: "emoticon-angry-outline", label: "분노" },
  ANXIETY: { icon: "emoticon-frown-outline", label: "불안" },
  EMBARRASSMENT: { icon: "emoticon-confused-outline", label: "당황" },
  HURT: { icon: "emoticon-sad-outline", label: "상처" },
  JOY: { icon: "emoticon-happy-outline", label: "기쁨" },
  NEUTRAL: { icon: "emoticon-neutral-outline", label: "평온" },
  SADNESS: { icon: "emoticon-cry-outline", label: "슬픔" },
};

export function getReportPageState(
  page: CareReceiverReportPage
): ReportPageState {
  if (page.latestDailyReport) {
    return "ready";
  }

  return page.todayCalls.length > 0 ? "dailyPending" : "empty";
}

export function sortCallsByStartedAt(
  calls: readonly CallReportView[]
): readonly CallReportView[] {
  return [...calls].sort((left, right) =>
    left.startedAtLabel.localeCompare(right.startedAtLabel)
  );
}

export function toCareReceiverReportPage(
  target: CareReceiverReportTarget,
  callsResult: DailyReportResult,
  dailyResult: DailyReportResult = callsResult,
  reportCalendar?: ReportCalendar
): CareReceiverReportPage {
  return {
    displayName: target.displayName,
    latestDailyReport: dailyResult.dailyReport
      ? {
          emotion:
            EMOTION_PRESENTATIONS[dailyResult.dailyReport.emotionCategory],
          guardianMessageSummary:
            dailyResult.dailyReport.guardianMessageSummary,
          id: dailyResult.dailyReport.id,
          reportDate: dailyResult.date,
          reportDateLabel: formatReportDate(dailyResult.date),
          summary: dailyResult.dailyReport.summary,
        }
      : null,
    memberId: target.memberId,
    reportCalendar,
    todayCalls: callsResult.calls.map((call) => ({
      callSessionId: call.callSessionId,
      guardianMessage: null,
      reportAvailable: call.reportAvailable,
      reportDateLabel: formatReportDate(callsResult.date, "."),
      startedAtLabel: formatStartedAt(call.startedAt),
      summary: null,
    })),
  };
}

function formatReportDate(date: string, separator = "년 "): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    return date;
  }

  const [, year, month, day] = match;
  if (separator === ".") {
    return `${year}.${month}.${day}`;
  }
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

function formatStartedAt(startedAt: string): string {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) {
    return startedAt;
  }

  const parts = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value;
  const minute = parts.find((part) => part.type === "minute")?.value;

  return hour && minute ? `${hour}:${minute}` : startedAt;
}
