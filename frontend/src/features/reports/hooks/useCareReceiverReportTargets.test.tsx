import React from "react";
import TestRenderer from "react-test-renderer";

import { createReportCache, type ReportCache } from "../reportCache";
import type { CareReceiverReportTarget } from "../types";
import { useCareReceiverReportTargets } from "./useCareReceiverReportTargets";

const cachedTargets: readonly CareReceiverReportTarget[] = [
  { displayName: "김말순", memberId: "12" },
];

interface Observed {
  statuses: string[];
  targets: (readonly CareReceiverReportTarget[] | undefined)[];
}

function Harness({
  cache,
  loader,
  observed,
}: {
  cache: ReportCache;
  loader: TargetsLoader;
  observed: Observed;
}) {
  const state = useCareReceiverReportTargets({
    cache,
    enabled: true,
    groupId: "group-1",
    loader,
  });

  // 렌더마다 기록해 loading 단계를 실제로 거쳤는지까지 확인한다.
  observed.statuses.push(state.status);
  observed.targets.push(state.status === "ready" ? state.targets : undefined);

  return null;
}

type TargetsLoader = (
  groupId: string
) => Promise<readonly CareReceiverReportTarget[]>;

async function render(cache: ReportCache, loader: TargetsLoader) {
  const observed: Observed = { statuses: [], targets: [] };
  let renderer: TestRenderer.ReactTestRenderer | undefined;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <Harness cache={cache} loader={loader} observed={observed} />
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  TestRenderer.act(() => {
    renderer?.unmount();
  });

  return observed;
}

test("캐시가 없으면 로딩을 거쳐 목록을 표시한다", async () => {
  const cache = createReportCache();
  const loader = jest.fn().mockResolvedValue(cachedTargets);

  const observed = await render(cache, loader);

  expect(observed.statuses).toContain("loading");
  expect(observed.statuses.at(-1)).toBe("ready");
  expect(cache.getTargets("group-1")).toEqual(cachedTargets);
});

test("캐시가 있으면 로딩 없이 바로 목록을 표시하고 뒤에서 다시 조회한다", async () => {
  const cache = createReportCache();
  cache.setTargets("group-1", cachedTargets);
  const loader = jest.fn().mockResolvedValue(cachedTargets);

  const observed = await render(cache, loader);

  // 첫 렌더는 항상 초기값 idle이므로 그 뒤 상태만 본다.
  expect(observed.statuses).not.toContain("loading");
  expect(observed.statuses.filter((status) => status !== "idle")).toEqual([
    "ready",
    "ready",
  ]);
  expect(loader).toHaveBeenCalledTimes(1);
});

test("재검증 결과가 같으면 캐시된 배열 참조를 유지한다", async () => {
  const cache = createReportCache();
  cache.setTargets("group-1", cachedTargets);
  // 내용은 같지만 참조가 다른 응답. 참조가 새로 생기면 useReportPages가 전체를 다시 부른다.
  const loader = jest
    .fn()
    .mockResolvedValue([{ displayName: "김말순", memberId: "12" }]);

  const observed = await render(cache, loader);

  const readyTargets = observed.targets.filter(
    (targets) => targets !== undefined
  );
  expect(readyTargets.length).toBeGreaterThan(0);
  expect(readyTargets.every((targets) => targets === cachedTargets)).toBe(true);
});

test("재검증 결과가 다르면 최신 목록으로 교체한다", async () => {
  const cache = createReportCache();
  cache.setTargets("group-1", cachedTargets);
  const freshTargets: readonly CareReceiverReportTarget[] = [
    { displayName: "김말순", memberId: "12" },
    { displayName: "박순자", memberId: "13" },
  ];
  const loader = jest.fn().mockResolvedValue(freshTargets);

  const observed = await render(cache, loader);

  expect(observed.targets.at(-1)).toEqual(freshTargets);
  expect(cache.getTargets("group-1")).toEqual(freshTargets);
});

test("캐시로 목록을 보여주는 중이면 재검증 실패해도 에러로 되돌리지 않는다", async () => {
  const cache = createReportCache();
  cache.setTargets("group-1", cachedTargets);
  const loader = jest.fn().mockRejectedValue(new Error("network"));

  const observed = await render(cache, loader);

  expect(observed.statuses).not.toContain("error");
  expect(observed.targets.at(-1)).toBe(cachedTargets);
});

test("캐시를 비운 뒤 도착한 응답은 목록을 다시 채우지 않는다", async () => {
  const cache = createReportCache();
  let resolveTargets:
    | ((value: readonly CareReceiverReportTarget[]) => void)
    | undefined;
  const loader = jest.fn(
    () =>
      new Promise<readonly CareReceiverReportTarget[]>((resolve) => {
        resolveTargets = resolve;
      })
  );

  const observed: Observed = { statuses: [], targets: [] };
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <Harness cache={cache} loader={loader} observed={observed} />
    );
  });

  // 조회가 떠 있는 사이에 로그아웃으로 캐시를 비운다.
  cache.clear();
  await TestRenderer.act(async () => {
    resolveTargets?.(cachedTargets);
    await Promise.resolve();
  });

  expect(cache.getTargets("group-1")).toBeUndefined();

  TestRenderer.act(() => {
    renderer?.unmount();
  });
});

test("캐시가 없을 때 조회에 실패하면 에러를 표시한다", async () => {
  const cache = createReportCache();
  const loader = jest.fn().mockRejectedValue(new Error("network"));

  const observed = await render(cache, loader);

  expect(observed.statuses.at(-1)).toBe("error");
});
