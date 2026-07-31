import {useCallback, useEffect, useState} from 'react';

import {
  loadGroupInviteCode,
  type GroupInviteCodeLoader,
} from '../api/groupMembershipApi';
import type {GroupInviteCodeLoadState} from '../types';

// 그룹 초대 코드를 비동기로 불러온다. 피드(useFeed)와 같은 로드 상태·재시도 형태다.
export function useGroupInviteCode(
  groupId: string,
  loader: GroupInviteCodeLoader = loadGroupInviteCode,
): GroupInviteCodeLoadState & {retry: () => void} {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<GroupInviteCodeLoadState>({
    status: 'loading',
  });

  useEffect(() => {
    let isActive = true;
    setState({status: 'loading'});

    loader(groupId)
      .then((result) => {
        if (isActive) {
          setState({inviteCode: result.inviteCode, status: 'success'});
        }
      })
      .catch(() => {
        if (isActive) {
          setState({
            message: '그룹 코드를 불러오지 못했어요. 다시 시도해 주세요.',
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

  return {...state, retry};
}
