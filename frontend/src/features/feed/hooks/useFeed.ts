import {useCallback, useEffect, useState} from 'react';

import {
  loadFeed,
  normalizeFeedPosts,
  type FeedLoader,
} from '../api/feedApi';
import type {FeedLoadState} from '../types';

export function useFeed(
  groupId: string,
  loader: FeedLoader = loadFeed,
): FeedLoadState & {retry: () => void} {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<FeedLoadState>({status: 'loading'});

  useEffect(() => {
    let isActive = true;
    setState({status: 'loading'});

    loader(groupId)
      .then(posts => {
        if (isActive) {
          setState({posts: normalizeFeedPosts(posts), status: 'success'});
        }
      })
      .catch(() => {
        if (isActive) {
          setState({
            message: '피드를 불러오지 못했어요. 다시 시도해 주세요.',
            status: 'error',
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [groupId, loader, reloadCount]);

  const retry = useCallback(() => {
    setReloadCount(count => count + 1);
  }, []);

  return {...state, retry};
}
