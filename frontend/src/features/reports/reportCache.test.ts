import { createReportCache, type ReadyCallReport } from "./reportCache";
import type { CareReceiverReportPage, CareReceiverReportTarget } from "./types";

function createReadyCallReport(callSessionId: string): ReadyCallReport {
  return {
    callSessionId,
    createdAt: "2026-07-31T00:30:00Z",
    guardianMessage: null,
    status: "ready",
    summary: `${callSessionId} 요약`,
  };
}

function createPage(memberId: string): CareReceiverReportPage {
  return {
    displayName: "김말순",
    latestDailyReport: null,
    memberId,
    selectedDateGenerationStatus: "notReady",
    todayCalls: [],
  };
}

const targets: readonly CareReceiverReportTarget[] = [
  { displayName: "김말순", memberId: "12" },
];

test("저장한 건별 리포트를 같은 통화 키로 다시 읽는다", () => {
  const cache = createReportCache();
  const report = createReadyCallReport("call-1");

  cache.setCallReport(report);

  expect(cache.getCallReport("call-1")).toBe(report);
  expect(cache.getCallReport("call-2")).toBeUndefined();
});

test("건별 리포트가 상한을 넘으면 오래된 항목부터 밀어낸다", () => {
  const cache = createReportCache({ maxCallReports: 2 });

  cache.setCallReport(createReadyCallReport("call-1"));
  cache.setCallReport(createReadyCallReport("call-2"));
  cache.setCallReport(createReadyCallReport("call-3"));

  expect(cache.getCallReport("call-1")).toBeUndefined();
  expect(cache.getCallReport("call-2")).toBeDefined();
  expect(cache.getCallReport("call-3")).toBeDefined();
});

test("같은 키를 다시 쓰면 방금 쓴 항목이 먼저 밀려나지 않는다", () => {
  const cache = createReportCache({ maxCallReports: 2 });

  cache.setCallReport(createReadyCallReport("call-1"));
  cache.setCallReport(createReadyCallReport("call-2"));
  cache.setCallReport(createReadyCallReport("call-1"));
  cache.setCallReport(createReadyCallReport("call-3"));

  expect(cache.getCallReport("call-1")).toBeDefined();
  expect(cache.getCallReport("call-2")).toBeUndefined();
  expect(cache.getCallReport("call-3")).toBeDefined();
});

test("페이지 스냅샷은 그룹과 기준일이 모두 같을 때만 재사용한다", () => {
  const cache = createReportCache();
  const pages = [createPage("12")];

  cache.setPages("group-1", "2026-07-31", pages);

  expect(cache.getPages("group-1", "2026-07-31")).toBe(pages);
  expect(cache.getPages("group-2", "2026-07-31")).toBeUndefined();
  expect(cache.getPages("group-1", "2026-07-30")).toBeUndefined();
});

test("페이지 스냅샷을 무효화하면 해당 키만 사라진다", () => {
  const cache = createReportCache();
  cache.setPages("group-1", "2026-07-31", [createPage("12")]);
  cache.setPages("group-1", "2026-07-30", [createPage("12")]);

  cache.invalidatePages("group-1", "2026-07-31");

  expect(cache.getPages("group-1", "2026-07-31")).toBeUndefined();
  expect(cache.getPages("group-1", "2026-07-30")).toBeDefined();
});

test("clear는 세 종류의 캐시를 모두 비운다", () => {
  const cache = createReportCache();
  cache.setCallReport(createReadyCallReport("call-1"));
  cache.setPages("group-1", "2026-07-31", [createPage("12")]);
  cache.setTargets("group-1", targets);

  cache.clear();

  expect(cache.getCallReport("call-1")).toBeUndefined();
  expect(cache.getPages("group-1", "2026-07-31")).toBeUndefined();
  expect(cache.getTargets("group-1")).toBeUndefined();
});
