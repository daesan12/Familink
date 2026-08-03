import {useEffect, useState} from 'react';

import type {JoinRequestsLoader} from '../api/groupMembershipApi';
import {pendingRequests} from '../joinRequestModel';
import type {PendingJoinCountState} from '../types';

// H-7 구성원 초대에 표시할 승인 대기 건수를 조회한다. 건수 필드를 내려주는
// 조회 API가 없어(API-GROUPS-004) 대기 요청 목록(API-GROUPS-008)의 길이로 센다.
//
// 목록 조회는 그룹 관리자만 허용되므로(403 NOT_GROUP_MANAGER) isManager가
// false면 확정 실패 요청을 보내지 않고 건수 미확정 상태로 남긴다. loader를
// 주입하지 않은 화면(개발용 목업)도 같은 미확정 상태로 둔다.
//
// reloadKey를 바꾸면 같은 그룹에서도 다시 조회한다. 가입 승인 대기 화면에서
// 승인·거절하고 돌아오면 호출부가 이 값을 올려 건수를 최신 상태로 맞춘다.
export function usePendingJoinCount(
  groupId: string,
  loader: JoinRequestsLoader | undefined,
  isManager: boolean,
  reloadKey: number,
): PendingJoinCountState {
  const [state, setState] = useState<PendingJoinCountState>({
    status: 'disabled',
  });

  useEffect(() => {
    if (loader === undefined || !isManager) {
      setState({status: 'disabled'});
      return;
    }

    let isActive = true;
    setState({status: 'loading'});

    loader(groupId)
      .then(requests => {
        if (isActive) {
          // 서버가 다른 상태를 함께 내려줘도 대기 중 요청만 센다.
          setState({
            count: pendingRequests(requests).length,
            status: 'success',
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setState({status: 'error'});
        }
      });

    return () => {
      isActive = false;
    };
  }, [groupId, isManager, loader, reloadKey]);

  return state;
}
