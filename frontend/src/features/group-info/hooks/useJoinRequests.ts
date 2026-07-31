import {useCallback, useEffect, useState} from 'react';

import {
  loadJoinRequests,
  type JoinRequestsLoader,
} from '../api/groupMembershipApi';
import {pendingRequests, removeRequest} from '../joinRequestModel';
import type {JoinRequestsLoadState} from '../types';

// 대기 중 가입 요청을 비동기로 불러오고, 처리한 요청을 목록에서 제거한다.
// 로드 상태·재시도 형태는 피드(useFeed)와 같다.
export function useJoinRequests(
  groupId: string,
  loader: JoinRequestsLoader = loadJoinRequests,
): JoinRequestsLoadState & {
  retry: () => void;
  remove: (joinRequestId: string) => void;
} {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<JoinRequestsLoadState>({
    status: 'loading',
  });

  useEffect(() => {
    let isActive = true;
    setState({status: 'loading'});

    loader(groupId)
      .then((requests) => {
        if (isActive) {
          // 서버가 다른 상태를 함께 내려줘도 대기 중 요청만 화면에 올린다.
          setState({requests: pendingRequests(requests), status: 'success'});
        }
      })
      .catch(() => {
        if (isActive) {
          setState({
            message: '가입 요청을 불러오지 못했어요. 다시 시도해 주세요.',
            status: 'error',
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [groupId, loader, reloadCount]);

  const retry = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  // 승인·거절한 요청을 목록에서 지운다. 성공 상태에서만 의미가 있다.
  const remove = useCallback((joinRequestId: string) => {
    setState((current) =>
      current.status === 'success'
        ? {
            ...current,
            requests: removeRequest(current.requests, joinRequestId),
          }
        : current,
    );
  }, []);

  return {...state, retry, remove};
}
