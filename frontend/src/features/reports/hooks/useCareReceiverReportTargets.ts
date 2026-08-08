import { useCallback, useEffect, useState } from "react";

import { reportCache as defaultReportCache, type ReportCache } from "../reportCache";
import type {
  CareReceiverReportTarget,
  CareReceiverReportTargetLoader,
} from "../types";

export type CareReceiverReportTargetsLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; targets: readonly CareReceiverReportTarget[] }
  | { message: string; status: "error" };

interface UseCareReceiverReportTargetsOptions {
  cache?: ReportCache;
  enabled: boolean;
  groupId: string;
  loader?: CareReceiverReportTargetLoader;
}

export function useCareReceiverReportTargets({
  cache = defaultReportCache,
  enabled,
  groupId,
  loader,
}: UseCareReceiverReportTargetsOptions): CareReceiverReportTargetsLoadState & {
  retry: () => void;
} {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<CareReceiverReportTargetsLoadState>({
    status: "idle",
  });

  useEffect(() => {
    if (!enabled || loader === undefined) {
      setState({ status: "idle" });
      return;
    }

    let isActive = true;
    // 캐시가 있으면 로딩 화면을 건너뛰고 바로 보여준 뒤 뒤에서 다시 조회한다.
    // 피보호자 목록은 멤버 변동으로 바뀔 수 있어 항상 재검증한다.
    const cached = cache.getTargets(groupId);
    const cacheGeneration = cache.generation();
    setState(
      cached ? { status: "ready", targets: cached } : { status: "loading" }
    );

    loader(groupId)
      .then((targets) => {
        // 내용이 같으면 기존 배열 참조를 유지한다. 참조가 바뀌면 이 목록을
        // 의존성으로 쓰는 useReportPages가 전체 페이지를 다시 불러온다.
        const nextTargets =
          cached && areTargetsEqual(cached, targets) ? cached : targets;
        cache.setTargets(groupId, nextTargets, cacheGeneration);
        if (isActive) {
          setState({ status: "ready", targets: nextTargets });
        }
      })
      .catch(() => {
        if (!isActive || cached) {
          // 이미 캐시로 목록을 보여주는 중이면 재검증 실패로 에러 화면에 되돌리지 않는다.
          return;
        }
        setState({
          message: "피보호자 목록을 불러오지 못했어요. 다시 시도해 주세요.",
          status: "error",
        });
      });

    return () => {
      isActive = false;
    };
  }, [cache, enabled, groupId, loader, reloadCount]);

  const retry = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  return { ...state, retry };
}

function areTargetsEqual(
  left: readonly CareReceiverReportTarget[],
  right: readonly CareReceiverReportTarget[]
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (target, index) =>
        target.memberId === right[index].memberId &&
        target.displayName === right[index].displayName
    )
  );
}
