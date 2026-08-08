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
  date = REPORT_DATE,
  observed,
  reportGateway,
  targetList,
}: {
  cache: ReportCache;
  date?: string;
  observed: Observed;
  reportGateway: ReportGateway;
  targetList: readonly CareReceiverReportTarget[];
}) {
  const state = useReportPages({
    cache,
    enabled: true,
    groupId: GROUP_ID,
    reportDate: date,
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

test("재조회가 진행 중이면 전체 재검증 결과를 스냅샷에 남기지 않는다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();
  let resolveInitial: ((value: DailyReportResult) => void) | undefined;
  gateway.getDailyReport
    .mockReturnValueOnce(
      new Promise<DailyReportResult>((resolve) => {
        resolveInitial = resolve;
      })
    )
    // 재조회는 끝나지 않은 채로 둬서 전체 응답이 도착하는 순간에도 진행 중이게 한다.
    .mockReturnValueOnce(new Promise<DailyReportResult>(() => {}));

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

  // 재조회 중인 멤버의 낡은 데이터가 스냅샷에 박히면 안 된다.
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeUndefined();

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("재조회가 먼저 끝난 뒤 도착한 전체 응답이 최신 결과를 되돌리지 않는다", async () => {
  const cache = createReportCache();
  cache.setPages(GROUP_ID, REPORT_DATE, [createPage("12")]);
  const gateway = createGateway();
  const generatedReport = {
    emotionCategory: "JOY" as const,
    emotionSubcategory: "즐거움",
    guardianMessageSummary: null,
    id: "daily-1",
    summary: "생성된 일간 리포트입니다.",
  };
  let resolveInitial: ((value: DailyReportResult) => void) | undefined;
  gateway.getDailyReport
    // 전체 재검증은 느리게 끝나고 생성 이전 데이터를 담고 있다.
    .mockReturnValueOnce(
      new Promise<DailyReportResult>((resolve) => {
        resolveInitial = resolve;
      })
    )
    // 일일 리포트 생성 완료로 촉발된 재조회가 먼저 끝난다.
    .mockResolvedValue({
      calls: [],
      dailyReport: generatedReport,
      date: REPORT_DATE,
      generationStatus: "ready",
    });

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

  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
    await Promise.resolve();
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

  // 화면에서 방금 생성된 리포트가 사라지면 안 된다.
  const lastItem = observed.items.at(-1)?.[0];
  expect(lastItem?.status).toBe("ready");
  expect(
    lastItem?.status === "ready" ? lastItem.page.latestDailyReport : null
  ).not.toBeNull();
  // 스냅샷도 생성 이전 데이터로 덮어써지면 안 된다.
  expect(cache.getPages(GROUP_ID, REPORT_DATE)?.[0].latestDailyReport).not.toBeNull();

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("기준일이 바뀐 뒤 도착한 낡은 전체 응답이 이전 날짜 스냅샷을 덮어쓰지 않는다", async () => {
  const OTHER_DATE = "2026-07-30";
  const cache = createReportCache();
  cache.setPages(GROUP_ID, REPORT_DATE, [createPage("12")]);
  const gateway = createGateway();
  const generatedReport = {
    emotionCategory: "JOY" as const,
    emotionSubcategory: "즐거움",
    guardianMessageSummary: null,
    id: "daily-1",
    summary: "생성된 일간 리포트입니다.",
  };
  let resolveInitial: ((value: DailyReportResult) => void) | undefined;
  gateway.getDailyReport
    // 기준일 REPORT_DATE의 전체 재검증. 생성 이전 데이터를 담고 느리게 끝난다.
    .mockReturnValueOnce(
      new Promise<DailyReportResult>((resolve) => {
        resolveInitial = resolve;
      })
    )
    // 생성 완료로 촉발된 재조회가 먼저 끝난다.
    .mockResolvedValueOnce({
      calls: [],
      dailyReport: generatedReport,
      date: REPORT_DATE,
      generationStatus: "ready",
    })
    // 기준일을 바꾼 뒤의 전체 로드.
    .mockResolvedValue({
      calls: [],
      dailyReport: null,
      date: OTHER_DATE,
      generationStatus: "notReady",
    });

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

  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  // 달력에서 다른 날짜를 고르면 effect가 다시 실행돼 기준이 새로 만들어진다.
  await TestRenderer.act(async () => {
    renderer?.update(
      <Harness
        cache={cache}
        date={OTHER_DATE}
        observed={observed}
        reportGateway={gateway}
        targetList={targets}
      />
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  // 이제서야 첫 기준일의 낡은 응답이 도착한다.
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

  // 화면은 이미 다른 날짜지만, 이전 날짜 스냅샷이 생성 이전 데이터로 오염되면
  // 그 날짜로 돌아왔을 때 낡은 페이지가 그대로 보인다.
  expect(
    cache.getPages(GROUP_ID, REPORT_DATE)?.[0].latestDailyReport
  ).not.toBeNull();

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("재조회한 멤버 자리만 유지하고 나머지는 전체 재검증 결과를 반영한다", async () => {
  const twoTargets: readonly CareReceiverReportTarget[] = [
    { displayName: "김말순", memberId: "12" },
    { displayName: "박순자", memberId: "13" },
  ];
  const cache = createReportCache();
  cache.setPages(GROUP_ID, REPORT_DATE, [createPage("12"), createPage("13")]);
  const gateway = createGateway();
  const generatedReport = {
    emotionCategory: "JOY" as const,
    emotionSubcategory: "즐거움",
    guardianMessageSummary: null,
    id: "daily-1",
    summary: "생성된 일간 리포트입니다.",
  };
  const refreshedReport = {
    ...generatedReport,
    id: "daily-2",
    summary: "전체 재검증으로 받은 리포트입니다.",
  };
  const pending = new Promise<DailyReportResult>(() => {});
  let resolveFirst: ((value: DailyReportResult) => void) | undefined;
  let resolveSecond: ((value: DailyReportResult) => void) | undefined;
  gateway.getDailyReport.mockImplementation(async (_groupId, memberId) => {
    if (memberId === "12") {
      // 12는 전체 재검증이 느리고, 그 사이 재조회가 끝난다.
      if (resolveFirst === undefined) {
        return new Promise<DailyReportResult>((resolve) => {
          resolveFirst = resolve;
        });
      }
      return {
        calls: [],
        dailyReport: generatedReport,
        date: REPORT_DATE,
        generationStatus: "ready",
      };
    }
    if (resolveSecond === undefined) {
      return new Promise<DailyReportResult>((resolve) => {
        resolveSecond = resolve;
      });
    }
    return pending;
  });

  const observed: Observed = { items: [], retry: undefined, statuses: [] };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <Harness
        cache={cache}
        observed={observed}
        reportGateway={gateway}
        targetList={twoTargets}
      />
    );
  });

  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  // 전체 재검증이 뒤늦게 두 멤버 모두의 결과를 들고 도착한다.
  await TestRenderer.act(async () => {
    resolveFirst?.({
      calls: [],
      dailyReport: null,
      date: REPORT_DATE,
      generationStatus: "notReady",
    });
    resolveSecond?.({
      calls: [],
      dailyReport: refreshedReport,
      date: REPORT_DATE,
      generationStatus: "ready",
    });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  const lastItems = observed.items.at(-1);
  const summaryOf = (index: number) => {
    const item = lastItems?.[index];
    return item?.status === "ready"
      ? item.page.latestDailyReport?.summary ?? null
      : null;
  };

  // 12는 재조회 결과를 지키고, 13은 전체 재검증 결과를 받아야 한다.
  expect(summaryOf(0)).toBe(generatedReport.summary);
  expect(summaryOf(1)).toBe(refreshedReport.summary);

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("로딩 중 재조회가 겹쳐도 전체 재검증 결과가 반영된다", async () => {
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

  // 캐시가 없어 loading인 상태에서 재조회가 끼어드는 경로.
  expect(observed.statuses.at(-1)).toBe("loading");
  await TestRenderer.act(async () => {
    observed.retry?.("12");
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

  // 어떤 응답도 반영되지 않아 로딩 화면이 고착되면 안 된다.
  expect(observed.statuses.at(-1)).toBe("ready");

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("재조회에 성공하면 스냅샷의 해당 멤버만 최신 페이지로 갱신한다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();

  const { observed, unmount } = await render(cache, gateway);
  const before = cache.getPages(GROUP_ID, REPORT_DATE);
  expect(before).toBeDefined();

  // 일일 리포트 생성 완료 콜백이 이 경로로 재조회를 요청한다.
  gateway.getDailyReport.mockResolvedValue({
    calls: [],
    dailyReport: {
      emotionCategory: "JOY",
      emotionSubcategory: "즐거움",
      guardianMessageSummary: null,
      id: "daily-1",
      summary: "생성된 일간 리포트입니다.",
    },
    date: REPORT_DATE,
    generationStatus: "ready",
  });

  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

  // 스냅샷이 사라지면 다음 진입에서 전체 로딩이 다시 뜬다.
  const after = cache.getPages(GROUP_ID, REPORT_DATE);
  expect(after).toHaveLength(1);
  expect(after?.[0].memberId).toBe("12");
  expect(after?.[0].latestDailyReport).not.toBeNull();
  expect(after).not.toEqual(before);
  unmount();
});

test("재조회에 실패하면 낡은 스냅샷을 무효화한다", async () => {
  const cache = createReportCache();
  const gateway = createGateway();

  const { observed, unmount } = await render(cache, gateway);
  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeDefined();

  gateway.getDailyReport.mockRejectedValue(new Error("network"));
  await TestRenderer.act(async () => {
    observed.retry?.("12");
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeUndefined();
  unmount();
});

test("캐시를 비운 뒤 도착한 응답은 스냅샷을 다시 채우지 않는다", async () => {
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

  // 조회가 떠 있는 사이에 로그아웃으로 캐시를 비운다.
  cache.clear();
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

  expect(cache.getPages(GROUP_ID, REPORT_DATE)).toBeUndefined();

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});
