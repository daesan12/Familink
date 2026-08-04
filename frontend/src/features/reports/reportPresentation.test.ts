import {
  DAILY_PENDING_REPORT_PAGE,
  EMPTY_REPORT_PAGE,
} from "./fixtures/reportFixtures";
import { getReportPageState, sortCallsByStartedAt } from "./reportPresentation";
import type { CallReportView, CareReceiverReportPage } from "./types";

test("리포트가 한 건도 없으면 전체 빈 상태를 반환한다", () => {
  expect(getReportPageState(EMPTY_REPORT_PAGE)).toBe("empty");
});

test("건별 리포트만 있으면 일간 리포트 준비 상태를 반환한다", () => {
  expect(getReportPageState(DAILY_PENDING_REPORT_PAGE)).toBe("dailyPending");
});

test("당일 통화가 없어도 최신 일간 리포트가 있으면 준비된 상태를 반환한다", () => {
  const page: CareReceiverReportPage = {
    displayName: "김말순",
    latestDailyReport: {
      emotion: { icon: "emoticon-neutral-outline", label: "평온" },
      guardianMessageSummary: null,
      id: "daily-latest",
      reportDate: "2026-07-16",
      reportDateLabel: "2026년 7월 16일",
      summary: "편안하게 하루를 보내셨어요.",
    },
    memberId: "care-receiver-1",
    todayCalls: [],
  };

  expect(getReportPageState(page)).toBe("ready");
});

test("건별 리포트를 통화 시작 시각 오름차순으로 정렬한다", () => {
  const calls: readonly CallReportView[] = [
    {
      callSessionId: "call-evening",
      guardianMessage: null,
      reportAvailable: true,
      reportDateLabel: "2026.07.18",
      startedAtLabel: "18:30",
      summary: "저녁 통화",
    },
    {
      callSessionId: "call-morning",
      guardianMessage: null,
      reportAvailable: true,
      reportDateLabel: "2026.07.18",
      startedAtLabel: "10:32",
      summary: "아침 통화",
    },
  ];

  expect(sortCallsByStartedAt(calls).map((call) => call.callSessionId)).toEqual(
    ["call-morning", "call-evening"]
  );
  expect(calls[0].callSessionId).toBe("call-evening");
});
