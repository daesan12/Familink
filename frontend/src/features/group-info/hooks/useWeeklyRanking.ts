import {useCallback, useEffect, useState} from 'react';

import {loadWeeklyRanking, type WeeklyRankingLoader} from '../api/rankingApi';
import type {WeeklyRankingLoadState} from '../types';

// 그룹의 주간 효자 랭킹을 비동기로 불러온다. 피드(useFeed)와 같은 형태로
// 로딩·성공·실패 상태와 재시도를 제공한다. groupId가 바뀌면 다시 불러온다.
export function useWeeklyRanking(
  groupId: string,
  loader: WeeklyRankingLoader = loadWeeklyRanking,
): WeeklyRankingLoadState & {retry: () => void} {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<WeeklyRankingLoadState>({
    status: 'loading',
  });

  useEffect(() => {
    let isActive = true;
    setState({status: 'loading'});

    loader(groupId)
      .then((snapshot) => {
        if (isActive) {
          setState({snapshot, status: 'success'});
        }
      })
      .catch(() => {
        if (isActive) {
          setState({
            message: '랭킹을 불러오지 못했어요. 다시 시도해 주세요.',
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
