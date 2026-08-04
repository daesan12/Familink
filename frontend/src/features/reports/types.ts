// 감정 배지에 쓰는 머티리얼 아이콘 이름. OS 기본 이모지 대신
// 앱 아이콘과 같은 플랫한 라인 스타일로 통일한다.
export type ReportEmotionIcon =
  | "emoticon-angry-outline"
  | "emoticon-confused-outline"
  | "emoticon-cry-outline"
  | "emoticon-frown-outline"
  | "emoticon-happy-outline"
  | "emoticon-neutral-outline"
  | "emoticon-sad-outline";

export interface ReportEmotionPresentation {
  icon: ReportEmotionIcon;
  label: string;
}

export type ReportEmotionCategory =
  | "ANGER"
  | "SADNESS"
  | "ANXIETY"
  | "HURT"
  | "EMBARRASSMENT"
  | "JOY"
  | "NEUTRAL";

export interface ReportCalendar {
  latestReportDate: string | null;
  reportDates: readonly string[];
  yearMonth: string;
}

export interface DailyReport {
  emotionCategory: ReportEmotionCategory;
  emotionSubcategory: string;
  guardianMessageSummary: string | null;
  id: string;
  summary: string;
}

export interface DailyCall {
  callSessionId: string;
  reportAvailable: boolean;
  startedAt: string;
}

interface DailyReportResultBase {
  calls: readonly DailyCall[];
  date: string;
}

export type DailyReportResult =
  | (DailyReportResultBase & {
      calls: readonly [];
      dailyReport: null;
      status: "noCalls";
    })
  | (DailyReportResultBase & {
      dailyReport: null;
      status: "generating";
    })
  | (DailyReportResultBase & {
      dailyReport: DailyReport;
      status: "ready";
    });

export type CallReport =
  | {
      callSessionId: string;
      status: "generating";
    }
  | {
      callSessionId: string;
      createdAt: string;
      guardianMessage: string | null;
      status: "ready";
      summary: string;
    };

export interface ReportGateway {
  getReportDates(
    groupId: string,
    memberId: string,
    year: number,
    month: number
  ): Promise<ReportCalendar>;

  getDailyReport(
    groupId: string,
    memberId: string,
    reportDate: string
  ): Promise<DailyReportResult>;

  getCallReport(callSessionId: string): Promise<CallReport>;
}

export interface CareReceiverReportTarget {
  displayName: string;
  memberId: string;
}

export type CareReceiverReportTargetLoader = (
  groupId: string
) => Promise<readonly CareReceiverReportTarget[]>;

export interface DailyReportView {
  emotion: ReportEmotionPresentation;
  guardianMessageSummary: string | null;
  id: string;
  reportDate: string;
  reportDateLabel: string;
  summary: string;
}

export interface CallReportView {
  callSessionId: string;
  guardianMessage: string | null;
  reportAvailable: boolean;
  reportDateLabel: string;
  startedAtLabel: string;
  summary: string | null;
}

export interface CareReceiverReportPage {
  displayName: string;
  latestDailyReport: DailyReportView | null;
  memberId: string;
  reportCalendar?: ReportCalendar;
  todayCalls: readonly CallReportView[];
}

export type ReportPageState = "empty" | "dailyPending" | "ready";

export type CallReportDetailState =
  | { call: CallReportView; status: "loading" }
  | { call: CallReportView; status: "generating" }
  | { call: CallReportView; status: "ready" }
  | { call: CallReportView; status: "error" };
