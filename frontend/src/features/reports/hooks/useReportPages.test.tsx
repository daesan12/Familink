import React from "react";
import TestRenderer from "react-test-renderer";

import { createReportCache, type ReportCache } from "../reportCache";
import type {
  CareReceiverReportPage,
  CareReceiverReportTarget,
  DailyReportResult,
  ReportGateway,
} from "../types";
import { type ReportPageLoadItem, useReportPages } from "./useReportPages";

const GROUP_ID = "group-1";
const REPORT_DATE = "2026-07-31";

const targets: readonly CareReceiverReportTarget[] = [
  { displayName: "김말순", memberId: "12" },
];

function createPage(memberId: string): CareReceiverReportPage {
  return {
    displayName: "김말순",
    latestDailyReport: null,
    memberId,
    selectedDateGenerationStatus: "notReady",
    todayCalls: [],
  };
}

function createGateway(): jest.Mocked<ReportGateway> {
  return {
    getCallReport: jest.fn(),
    getCallReportStatus: jest.fn(),
    getDailyReport: jest.fn().mockResolvedValue({
      calls: [],
      dailyReport: null,
      date: REPORT_DATE,
      generationStatus: "notReady",
    }),
    getReportDates: jest.fn().mockResolvedValue({
      latestReportDate: null,
      reportDates: [],
      yearMonth: "2026-07",
    }),
    requestDailyReportGeneration: jest.fn(),
  };
}

interface Observed {
  items: (readonly ReportPageLoadItem[] | undefined)[];
  retry: ((memberId: string) => void) | undefined;
  statuses: string[];
}

function Harness({
  cache,
  observed,
  reportGateway,
  targetList,
}: {
  cache: ReportCache;
  observed: Observed;
  reportGateway: ReportGateway;
  targetList: readonly CareReceiverReportTarget[];
}) {
  const state = useReportPages({
    cache,
    enabled: true,
    groupId: GROUP_ID,
    reportDate: REPORT_DATE,
    reportGateway,
    targets: targetList,
  });

  // 렌더마다 기록해 loading 단계를 실제로 거쳤는지까지 확인한다.
  observed.statuses.push(state.status);
  observed.items.push(state.status === "ready" ? state.items : undefined);
  observed.retry = state.retry;

  return null;
}

async function render(
  cache: ReportCache,
  reportGateway: ReportGateway,
  targetList: readonly CareReceiverReportTarget[] = targets
) {
  const observed: Observed = { items: [], retry: undefined, statuses: [] };
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <Harness
        cache={cache}
        observed={observed}
        reportGateway={reportGateway}
        targetList={targetList}
      />
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  return {
    observed,
    unmount: () =>
      TestRenderer.act(() => {
        renderer?.unmount();
      }),
  };
}

test("캐시가 없으면 로딩을 거쳐 페이지를 표시하고 스냅샷을 남긴다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();

  const { observed, unmount } = await render(cache, gateway);
  unmount();

  expect(observed.statuses).toContain("loading");
  expect(observed.statuses.at(-1)).toBe("ready");
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toHaveLength(1);
});

test("캐시가 있으면 로딩 없이 바로 표시하고 뒤에서 다시 조회한다", async () => {
  const cache = createReportCache();
  cache.setPages(GROUP_ID, REPORT_DATE, [createPage("12")]);
  const gateway = createGateway();

  const { observed, unmount } = await render(cache, gateway);
  unmount();

  // 첫 렌더는 항상 초기값 idle이므로 그 뒤 상태만 본다.
  expect(observed.statuses).not.toContain("loading");
  expect(observed.statuses.filter((status) => status !== "idle")).toEqual([
    "ready",
    "ready",
  ]);
  expect(gateway.getDailyReport).toHaveBeenCalled();
});

test("멤버 구성이 다른 스냅샷은 재사용하지 않는다", async () => {
  const cache = createReportCache();
  cache.setPages(GROUP_ID, REPORT_DATE, [createPage("99")]);
  const gateway = createGateway();

  const { observed, unmount } = await render(cache, gateway);
  unmount();

  expect(observed.statuses).toContain("loading");
});

test("일부 멤버 조회가 실패한 스냅샷은 캐시하지 않는다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();
  gateway.getDailyReport.mockRejectedValue(new Error("network"));

  const { observed, unmount } = await render(cache, gateway);
  unmount();

  expect(observed.statuses.at(-1)).toBe("ready");
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeUndefined();
});

test("캐시로 보여주는 중이면 재검증이 실패해도 오류 화면으로 뒤집지 않는다", async () => {
  const cache = createReportCache();
  const cachedPage = createPage("12");
  cache.setPages(GROUP_ID, REPORT_DATE, [cachedPage]);
  const gateway = createGateway();
  gateway.getDailyReport.mockRejectedValue(new Error("network"));

  const { observed, unmount } = await render(cache, gateway);
  unmount();

  const lastItems = observed.items.at(-1);
  expect(lastItems).toHaveLength(1);
  expect(lastItems?.[0].status).toBe("ready");
  // 실패한 재검증이 캐시를 덮어쓰지도 않아야 한다.
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toEqual([cachedPage]);
});

test("여러 대상 중 실패한 자리에만 그 대상의 캐시 페이지를 채운다", async () => {
  const twoTargets: readonly CareReceiverReportTarget[] = [
    { displayName: "김말순", memberId: "12" },
    { displayName: "박순자", memberId: "13" },
  ];
  const cache = createReportCache();
  cache.setPages(GROUP_ID, REPORT_DATE, [createPage("12"), createPage("13")]);
  const gateway = createGateway();
  // 두 번째 대상만 실패한다. 첫 번째는 최신 결과, 두 번째는 캐시 페이지여야 한다.
  gateway.getDailyReport.mockImplementation(async (_groupId, memberId) => {
    if (memberId === "13") {
      throw new Error("network");
    }
    return {
      calls: [],
      dailyReport: null,
      date: REPORT_DATE,
      generationStatus: "notReady",
    };
  });

  const { observed, unmount } = await render(cache, gateway, twoTargets);
  unmount();

  const lastItems = observed.items.at(-1);
  expect(lastItems?.map((item) => item.status)).toEqual(["ready", "ready"]);
  expect(lastItems?.map((item) => item.target.memberId)).toEqual(["12", "13"]);
  expect(
    lastItems?.map((item) => (item.status === "ready" ? item.page.memberId : null))
  ).toEqual(["12", "13"]);
});

test("재조회 도중 도착한 이전 전체 재검증 응답은 무시한다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();
  let resolveInitial: ((value: DailyReportResult) => void) | undefined;
  gateway.getDailyReport.mockReturnValueOnce(
    new Promise<DailyReportResult>((resolve) => {
      resolveInitial = resolve;
    })
  );

  const observed: Observed = { items: [], retry: undefined, statuses: [] };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <Harness
        cache={cache}
        observed={observed}
        reportGateway={gateway}
        targetList={targets}
      />
    );
  });

  // 전체 재검증이 아직 끝나지 않은 사이에 재조회가 끼어든다.
  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
  });
  await TestRenderer.act(async () => {
    resolveInitial?.({
      calls: [],
      dailyReport: null,
      date: REPORT_DATE,
      generationStatus: "notReady",
    });
    await Promise.resolve();
    await Promise.resolve();
  });

  // 낡은 응답이 무효화한 스냅샷을 되살리면 안 된다.
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeUndefined();

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("재조회를 요청하면 낡은 스냅샷을 무효화한다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();

  const { observed, unmount } = await render(cache, gateway);
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeDefined();

  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
  });

  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeUndefined();
  unmount();
});
