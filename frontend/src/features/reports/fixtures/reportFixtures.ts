import type { CareReceiverReportPage } from "../types";

export const DEVELOPMENT_REPORT_PAGES: readonly CareReceiverReportPage[] = [
  {
    displayName: "손수호",
    latestDailyReport: {
      emotion: { icon: "emoticon-happy-outline", label: "기쁨" },
      guardianMessageSummary:
        "오랜만에 가족들과 함께 식사하고 싶다고 말씀하셨어요.",
      id: "daily-report-sooho-2026-07-17",
      reportDate: "2026-07-17",
      reportDateLabel: "2026년 7월 17일",
      summary:
        "가족 이야기를 나누며 즐거워하셨고, 저녁 산책을 기대하고 계셨어요.",
    },
    memberId: "care-receiver-sooho",
    selectedDateGenerationStatus: "available",
    todayCalls: [
      {
        callSessionId: "call-sooho-1032",
        guardianMessage: "주말에 시간이 되면 함께 점심을 먹고 싶다고 하셨어요.",
        reportAvailable: true,
        reportDateLabel: "2026.07.18",
        startedAtLabel: "10:32",
        summary:
          "아침 식사와 오늘 날씨에 관해 이야기하며 편안한 기분을 표현하셨어요.",
      },
      {
        callSessionId: "call-sooho-1830",
        guardianMessage: null,
        reportAvailable: true,
        reportDateLabel: "2026.07.18",
        startedAtLabel: "18:30",
        summary:
          "저녁 산책 중 본 꽃과 이웃에게 들은 반가운 소식을 이야기하셨어요.",
      },
    ],
  },
  {
    displayName: "김말순",
    latestDailyReport: {
      emotion: { icon: "emoticon-neutral-outline", label: "평온" },
      guardianMessageSummary: null,
      id: "daily-report-malsoon-2026-07-16",
      reportDate: "2026-07-16",
      reportDateLabel: "2026년 7월 16일",
      summary:
        "집에서 편안하게 하루를 보내셨고, 가족들의 안부를 궁금해하셨어요.",
    },
    memberId: "care-receiver-malsoon",
    selectedDateGenerationStatus: "notReady",
    todayCalls: [],
  },
];

export const EMPTY_REPORT_PAGE: CareReceiverReportPage = {
  displayName: "손수호",
  latestDailyReport: null,
  memberId: "care-receiver-empty",
  selectedDateGenerationStatus: "notReady",
  todayCalls: [],
};

export const DAILY_PENDING_REPORT_PAGE: CareReceiverReportPage = {
  displayName: "손수호",
  latestDailyReport: null,
  memberId: "care-receiver-daily-pending",
  selectedDateGenerationStatus: "available",
  todayCalls: [
    {
      callSessionId: "call-first-day-1032",
      guardianMessage: null,
      reportAvailable: true,
      reportDateLabel: "2026.07.18",
      startedAtLabel: "10:32",
      summary: "첫 AI 통화에서 오늘의 식사와 날씨에 관해 이야기하셨어요.",
    },
    {
      callSessionId: "call-first-day-1830",
      guardianMessage: null,
      reportAvailable: false,
      reportDateLabel: "2026.07.18",
      startedAtLabel: "18:30",
      summary: null,
    },
  ],
};
