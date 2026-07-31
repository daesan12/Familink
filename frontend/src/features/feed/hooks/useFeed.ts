import {useCallback, useEffect, useRef, useState} from 'react';

import {
  FEED_PAGE_SIZE,
  loadFeed,
  normalizeFeedPosts,
  type FeedLoader,
  type FeedPageLoader,
} from '../api/feedApi';
import type {FeedLoadState} from '../types';

export function useFeed(
  groupId: string,
  loader?: FeedLoader,
  pageLoader?: FeedPageLoader,
  currentMemberId?: string,
): FeedLoadState & {loadMore: () => void; retry: () => void} {
  const [reloadCount, setReloadCount] = useState(0);
  const [state, setState] = useState<FeedLoadState>({status: 'loading'});
  const stateRef = useRef(state);
  const nextPageRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let isActive = true;
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    nextPageRef.current = 0;
    loadingMoreRef.current = false;
    setState({status: 'loading'});

    if (pageLoader !== undefined) {
      pageLoader(groupId, 0, FEED_PAGE_SIZE, currentMemberId)
        .then(page => {
          if (isActive && generationRef.current === generation) {
            setState({
              hasNext: page.hasNext,
              isLoadingMore: false,
              posts: normalizeFeedPosts(page.posts),
              status: 'success',
            });
          }
        })
        .catch(() => {
          if (isActive && generationRef.current === generation) {
            setState({
              message: '피드를 불러오지 못했어요. 다시 시도해 주세요.',
              status: 'error',
            });
          }
        });
    } else {
      (loader ?? loadFeed)(groupId)
        .then(posts => {
          if (isActive && generationRef.current === generation) {
            setState({
              hasNext: false,
              isLoadingMore: false,
              posts: normalizeFeedPosts(posts),
              status: 'success',
            });
          }
        })
        .catch(() => {
          if (isActive && generationRef.current === generation) {
            setState({
              message: '피드를 불러오지 못했어요. 다시 시도해 주세요.',
              status: 'error',
            });
          }
        });
    }

    return () => {
      isActive = false;
      loadingMoreRef.current = false;
    };
  }, [currentMemberId, groupId, loader, pageLoader, reloadCount]);

  const loadMore = useCallback(() => {
    if (pageLoader === undefined || loadingMoreRef.current) {
      return;
    }

    const current = stateRef.current;
    if (current.status !== 'success' || !current.hasNext) {
      return;
    }

    const nextPage = nextPageRef.current + 1;
    const generation = generationRef.current;
    loadingMoreRef.current = true;
    setState(previous =>
      previous.status === 'success'
        ? {...previous, isLoadingMore: true}
        : previous,
    );

    pageLoader(groupId, nextPage, FEED_PAGE_SIZE, currentMemberId)
      .then(page => {
        if (generationRef.current !== generation) {
          return;
        }
        nextPageRef.current = nextPage;
        setState(previous => {
          if (previous.status !== 'success') {
            return previous;
          }

          const seenIds = new Set(previous.posts.map(post => post.id));
          const nextPosts = page.posts.filter(post => {
            if (seenIds.has(post.id)) {
              return false;
            }
            seenIds.add(post.id);
            return true;
          });
          return {
            hasNext: page.hasNext,
            isLoadingMore: false,
            posts: normalizeFeedPosts([...previous.posts, ...nextPosts]),
            status: 'success',
          };
        });
      })
      .catch(() => {
        if (generationRef.current !== generation) {
          return;
        }
        setState(previous =>
          previous.status === 'success'
            ? {...previous, isLoadingMore: false}
            : previous,
        );
      })
      .finally(() => {
        if (generationRef.current === generation) {
          loadingMoreRef.current = false;
        }
      });
  }, [currentMemberId, groupId, pageLoader]);

  const retry = useCallback(() => {
    setReloadCount(count => count + 1);
  }, []);

  return {loadMore, ...state, retry};
}
