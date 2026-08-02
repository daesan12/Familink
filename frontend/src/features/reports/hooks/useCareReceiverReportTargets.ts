import { useCallback, useEffect, useState } from "react";

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
  enabled: boolean;
  groupId: string;
  loader?: CareReceiverReportTargetLoader;
}

export function useCareReceiverReportTargets({
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
    setState({ status: "loading" });

    loader(groupId)
      .then((targets) => {
        if (isActive) {
          setState({ status: "ready", targets });
        }
      })
      .catch(() => {
        if (isActive) {
          setState({
            message: "피보호자 목록을 불러오지 못했어요. 다시 시도해 주세요.",
            status: "error",
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [enabled, groupId, loader, reloadCount]);

  const retry = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  return { ...state, retry };
}
