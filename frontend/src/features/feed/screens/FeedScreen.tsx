import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState} from 'react';
import {StackActions,
  useIsFocused} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  } from '@react-navigation/native-stack';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Vibration,
  View,
  type ViewToken,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import type {AppScreenProps} from '../../../app-shell';
import {COLORS} from '../../../design/tokens';
import {ApiError} from '../../../shared/api';
import {RetryButton} from '../../../shared/components/RetryButton';
import {
  MemberProfilePopup,
  type GroupMembersLoader,
  type MemberCarnationLoader,
  type MemberProfileLoader,
  type WeeklyRankingLoader,
} from '../../group-info';
import type {
  FeedLoader,
  FeedPageLoader,
  PostDetailLoader,
} from '../api/feedApi';
import {
  COMMENT_PAGE_SIZE,
  type CommentCreateResult,
  type CommentPageLoader,
  type UpdatedComment,
} from '../api/commentApi';
import type {ReactionChangeResult} from '../api/reactionApi';
import {FeedItem} from '../components/FeedItem';
import {PostActionsSheet} from '../components/PostActionsSheet';
import {
  ReactionPopover,
} from '../components/ReactionPopover';
import type {ReactionAnchor} from '../components/ReactionBar';
import {
  createEditInitialValue,
  type PostComposerInitialValue,
  type PostSubmitPayload,
  type UploadState,
} from '../composer/postComposerModel';
import {
  DEVELOPMENT_COMMENTS_BY_POST_ID,
  DEVELOPMENT_CURRENT_USER,
} from '../fixtures/commentFixtures';
import {useFeed} from '../hooks/useFeed';
import {usePostInteractions} from '../hooks/usePostInteractions';
import type {FeedStackParamList} from '../navigationTypes';
import type {
  ChangeReactionInput,
  CreateCommentInput,
  DeleteCommentInput,
  FeedMember,
  FeedPost,
  PostComment,
  UpdateCommentInput,
} from '../types';
import {PostComposerScreen} from './PostComposerScreen';
import {PostDetailScreen} from './PostDetailScreen';

const EMPTY_COMMENTS_BY_POST_ID: Readonly<
  Record<string, readonly PostComment[]>
> = {};
const EMPTY_POSTS: readonly FeedPost[] = [];

// 피드 탭 내부 스택. 상세·작성이 조건부 렌더링 대신 스택 화면으로 열린다.
// 작성 화면도 셸 스택이 아니라 여기에 둔다 — 탭바 숨김은 풀스크린 신호가
// 담당하므로(셸 레벨 탭바) 승격 이점이 없고, 업로드 상태 머신을 FeedScreen
// 스코프에 유지할 수 있다.
const FeedStack = createNativeStackNavigator<FeedStackParamList>();

// 셸이 주입하는 공유 하위 화면. 라우트 이름은 AppRoute와 동일하다.
const SHARED_SUB_ROUTES = ['notifications', 'archive', 'joinApproval'] as const;

type FeedNavigation = NativeStackNavigationProp<FeedStackParamList>;

// 라우트 포커스를 셸 신호·목록 게이트용 미러로 보고한다. 반드시 모듈 레벨
// 유지 — 렌더 본문 안에서 정의하면 매 렌더 타입이 바뀌어 리마운트된다.
function RouteFocusReporter({
  onFocusChange,
}: {
  onFocusChange: (isFocused: boolean) => void;
}) {
  const isFocused = useIsFocused();

  useEffect(() => {
    onFocusChange(isFocused);
    return () => onFocusChange(false);
  }, [isFocused, onFocusChange]);

  return null;
}

// 상세 라우트의 마운트와 postId를 selectedPostId 미러로 동기화한다.
// unmount cleanup이 기존 하드웨어 백 핸들러의 정리(피커·메뉴·상세 상태 닫기)를
// 대체한다 — 스택 pop 한 번으로 오늘과 같은 동시 정리가 일어난다.
// 포커스 기준으로 재보고해야 한다: 이 상세 위에 다른 화면(작성 중 딥링크로
// 쌓인 두 번째 상세 등)이 pop되어 돌아왔을 때, 그 화면의 cleanup이 비운
// 미러를 복구하는 경로가 포커스 재보고뿐이다.
function DetailRouteSync({
  onClosed,
  onOpened,
  postId,
}: {
  onClosed: () => void;
  onOpened: (postId: string) => void;
  postId: string;
}) {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      onOpened(postId);
    }
  }, [isFocused, onOpened, postId]);

  useEffect(() => () => onClosed(), [onClosed]);

  return null;
}

export interface FeedScreenProps extends AppScreenProps {
  currentUser?: FeedMember | null;
  currentMemberId?: string;
  initialCommentsByPostId?: Readonly<
    Record<string, readonly PostComment[]>
  >;
  loader?: FeedLoader;
  pageLoader?: FeedPageLoader;
  detailLoader?: PostDetailLoader;
  onChangeReaction?: (
    input: ChangeReactionInput,
  ) => Promise<ReactionChangeResult | void> | ReactionChangeResult | void;
  onConfirmDelete?: (postId: string) => Promise<void> | void;
  onCreateComment?: (
    input: CreateCommentInput,
  ) => Promise<CommentCreateResult | void> | CommentCreateResult | void;
  onDeleteComment?: (
    input: DeleteCommentInput,
  ) => Promise<void> | void;
  onSubmitPost?: (
    payload: PostSubmitPayload,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ) => Promise<void> | void;
  onUpdateComment?: (
    input: UpdateCommentInput,
  ) => Promise<UpdatedComment | void> | UpdatedComment | void;
  commentsLoader?: CommentPageLoader;
  // 작성자 아바타 터치 시 그룹정보와 동일한 축소 프로필 팝업을 띄우기 위한
  // 구성원 조회 로더. membersLoader가 없으면 아바타는 기존처럼 터치되지 않는다.
  membersLoader?: GroupMembersLoader;
  memberProfileLoader?: MemberProfileLoader;
  memberCarnationLoader?: MemberCarnationLoader;
  rankingLoader?: WeeklyRankingLoader;
}

interface OpenReactionPicker {
  anchor: ReactionAnchor;
  postId: string;
}

interface CommentsState {
  error: string | null;
  hasNext: boolean;
  isLoading: boolean;
  page: number;
  postId: string | null;
}

export function FeedScreen({
  currentGroup,
  currentMemberId,
  commentsLoader,
  currentUser,
  detailLoader,
  initialCommentsByPostId,
  loader,
  onChangeReaction,
  onConfirmDelete,
  onCreateComment,
  onDeleteComment,
  onFullscreenChange,
  onHeaderVisibilityChange,
  onOpenNotifications,
  unreadNotificationCount,
  onSubmitPost,
  onUpdateComment,
  pageLoader,
  membersLoader,
  memberProfileLoader,
  memberCarnationLoader,
  rankingLoader,
  renderSharedSubRoute,
}: FeedScreenProps) {
  const feed = useFeed(
    currentGroup.id,
    loader,
    pageLoader,
    currentMemberId,
  );
  const posts = feed.status === 'success' ? feed.posts : EMPTY_POSTS;
  const feedPostsRef = useRef(posts);
  feedPostsRef.current = posts;
  const resolvedCurrentUser =
    currentUser === undefined
      ? __DEV__
        ? DEVELOPMENT_CURRENT_USER
        : null
      : currentUser;
  const resolvedInitialComments =
    initialCommentsByPostId ??
    (__DEV__
      ? DEVELOPMENT_COMMENTS_BY_POST_ID
      : EMPTY_COMMENTS_BY_POST_ID);
  // TODO: 그룹장·관리자별 추가 권한 정책이 확정되면 멤버십 권한을 주입한다.
  const canInteract = resolvedCurrentUser !== null;
  const interactions = usePostInteractions(
    posts,
    resolvedInitialComments,
  );
  // 프로필 팝업이 열린 작성자. 구성원 조회 로더가 없으면 아바타를 눌러도 열지 않는다.
  const [profileAuthor, setProfileAuthor] = useState<FeedMember | null>(null);
  const handlePressAuthor =
    membersLoader === undefined
      ? undefined
      : (author: FeedMember) => setProfileAuthor(author);
  const authorProfilePopup =
    membersLoader !== undefined && profileAuthor !== null ? (
      <MemberProfilePopup
        groupId={currentGroup.id}
        initialMember={{
          avatarText: profileAuthor.avatarText,
          memberId: profileAuthor.id,
          name: profileAuthor.name,
        }}
        memberCarnationLoader={memberCarnationLoader}
        memberId={profileAuthor.id}
        memberProfileLoader={memberProfileLoader}
        membersLoader={membersLoader}
        onClose={() => setProfileAuthor(null)}
        rankingLoader={rankingLoader}
      />
    ) : null;
  const interactionsRef = useRef(interactions);
  interactionsRef.current = interactions;
  // 상세 라우트의 미러. 진실 원천은 FeedStack이며 DetailRouteSync가 동기화한다.
  // 상세 데이터 로딩 effect·새로고침이 기존 그대로 이 값을 구독한다.
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<FeedPost | null>(null);
  const [isDetailRefreshing, setIsDetailRefreshing] = useState(false);
  const [menuPostId, setMenuPostId] = useState<string | null>(null);
  // 작성 라우트의 포커스 미러. 셸 풀스크린 신호(탭바·헤더 숨김)를 구동한다.
  // 마운트가 아니라 포커스 기준 — 작성 중 딥링크로 상세가 위에 쌓이는 엣지에서
  // 상세 화면인데 탭바가 숨는 비정합을 막는다.
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isHomeFocused, setIsHomeFocused] = useState(false);
  const [openReactionPicker, setOpenReactionPicker] =
    useState<OpenReactionPicker | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>({status: 'idle'});
  const [visiblePostIds, setVisiblePostIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [commentsState, setCommentsState] = useState<CommentsState>({
    error: null,
    hasNext: false,
    isLoading: false,
    page: 0,
    postId: null,
  });
  const feedNavRef = useRef<FeedNavigation | null>(null);
  // 수정 모드 작성 화면의 초깃값. 라우트 params에는 postId만 실리므로,
  // 수정 진입 시점의 스냅샷을 ref로 전달한다.
  const composerEditInitialValueRef = useRef<PostComposerInitialValue | null>(
    null,
  );
  const pendingUploadPayload = useRef<PostSubmitPayload | null>(null);
  const uploadAbortController = useRef<AbortController | null>(null);
  const commentsRequestId = useRef(0);
  const commentsLoading = useRef(false);
  const pendingReactionPostIds = useRef(new Set<string>());
  const nextLocalCommentId = useRef(1);
  const detailRequestId = useRef(0);
  const detailEntrySourceRef = useRef<'feed' | 'notification'>('feed');
  const previousGroupId = useRef(currentGroup.id);
  const isDeleteConfirmationOpen = useRef(false);
  const isDeleteSubmitting = useRef(false);
  const handleViewablePostsChanged = useRef(
    ({viewableItems}: {viewableItems: readonly ViewToken<FeedPost>[]}) => {
      setVisiblePostIds(
        new Set(
          viewableItems
            .filter(token => token.isViewable)
            .map(token => token.item.id),
        ),
      );
    },
  ).current;

  useEffect(() => {
    if (previousGroupId.current === currentGroup.id) {
      return;
    }
    previousGroupId.current = currentGroup.id;
    setMenuPostId(null);
    setOpenReactionPicker(null);
    uploadAbortController.current?.abort();
    pendingUploadPayload.current = null;
    setUploadState({status: 'idle'});
    // 이전 그룹의 상세가 열려 있으면 홈으로 되돌린다(상세 상태 정리는
    // DetailRouteSync cleanup → selectedPostId null 분기가 이어받는다).
    // 그룹 전환이 동반된 딥링크 상세는 params.groupId가 새 그룹과 일치하므로
    // 지우지 않는다 — 같은 커밋에 push된 목적지를 죽이지 않기 위한 판별자다.
    const stackState = feedNavRef.current?.getState();
    const topRoute = stackState?.routes[stackState.index];
    if (
      topRoute?.name === 'PostDetail' &&
      (topRoute.params as {groupId?: string} | undefined)?.groupId !==
        currentGroup.id
    ) {
      feedNavRef.current?.dispatch(StackActions.popTo('FeedHome'));
    }
  }, [currentGroup.id]);

  const loadCommentsPage = useCallback(
    (postId: string, page: number, replace: boolean) => {
      if (commentsLoader === undefined || commentsLoading.current) {
        return;
      }

      const requestId = commentsRequestId.current + 1;
      commentsRequestId.current = requestId;
      commentsLoading.current = true;
      setCommentsState(previous => ({
        error: null,
        hasNext: replace ? false : previous.hasNext,
        isLoading: true,
        page,
        postId,
      }));

      void commentsLoader(postId, page, COMMENT_PAGE_SIZE)
        .then(result => {
          if (commentsRequestId.current !== requestId) {
            return;
          }
          if (replace) {
            interactionsRef.current.replaceComments(
              postId,
              result.comments,
              true,
            );
          } else {
            interactionsRef.current.appendComments(postId, result.comments);
          }
          setCommentsState({
            error: null,
            hasNext: result.hasNext,
            isLoading: false,
            page,
            postId,
          });
        })
        .catch(error => {
          if (commentsRequestId.current !== requestId) {
            return;
          }
          setCommentsState(previous => ({
            ...previous,
            error:
              error instanceof Error
                ? error.message
                : '댓글을 불러오지 못했습니다. 다시 시도해 주세요.',
            isLoading: false,
            postId,
          }));
        })
        .finally(() => {
          if (commentsRequestId.current === requestId) {
            commentsLoading.current = false;
          }
        });
    },
    [commentsLoader],
  );

  useEffect(() => {
    if (selectedPostId === null) {
      detailRequestId.current += 1;
      setDetailPost(null);
      setIsDetailRefreshing(false);
      commentsRequestId.current += 1;
      commentsLoading.current = false;
      setCommentsState({
        error: null,
        hasNext: false,
        isLoading: false,
        page: 0,
        postId: null,
      });
      return;
    }

    const fallbackPost = feedPostsRef.current.find(
      post => post.id === selectedPostId,
    ) ?? null;
    setDetailPost(fallbackPost);

    if (commentsLoader !== undefined) {
      commentsRequestId.current += 1;
      commentsLoading.current = false;
      loadCommentsPage(selectedPostId, 0, true);
    } else {
      setCommentsState({
        error: null,
        hasNext: false,
        isLoading: false,
        page: 0,
        postId: selectedPostId,
      });
    }

    if (detailLoader === undefined) {
      return;
    }

    const requestId = detailRequestId.current + 1;
    detailRequestId.current = requestId;
    let isActive = true;

    detailLoader(selectedPostId, currentMemberId, currentGroup.id)
      .then(post => {
        if (post.groupId !== currentGroup.id) {
          throw new Error('The post belongs to a different group.');
        }
        if (isActive && detailRequestId.current === requestId) {
          interactionsRef.current.setCommentCount(
            post.id,
            post.commentCount,
          );
          setDetailPost(post);
        }
      })
      .catch(error => {
        const isDeletedNotificationPost =
          detailEntrySourceRef.current === 'notification' &&
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404);
        if (
          isActive &&
          detailRequestId.current === requestId &&
          fallbackPost === null &&
          !isDeletedNotificationPost
        ) {
          setDetailPost(null);
          // 실패한 상세 한 장만 걷어낸다. popTo('FeedHome')은 아래에 깔린
          // dirty 작성 화면까지 경고 없이 파괴한다.
          feedNavRef.current?.goBack();
        }
        if (isActive && detailRequestId.current === requestId) {
          if (isDeletedNotificationPost) {
            Alert.alert(
              '게시글을 볼 수 없어요',
              '작성자가 게시글을 삭제했거나 더 이상 볼 수 없습니다.',
              [
                {
                  // 두 호출은 서로 다른 스택 형태를 담당하므로 둘 다 필요하다.
                  // 알림 목록에서 열었으면 [FeedHome, notifications, PostDetail]
                  // 이라 goBack()이 알림으로 돌아가고, 두 번째 호출은 대상이
                  // 이미 최상단이어서 singleTop 무동작이 된다.
                  // 푸시를 탭해 상세로 바로 들어왔으면(앱 종료 콜드 스타트든
                  // 피드에 머무는 중 백그라운드 푸시든) [FeedHome, PostDetail]
                  // 이라 goBack()이 피드 목록으로 가고, 알림을 여는 것은 두 번째
                  // 호출뿐이다. 어느 하나만 남기면 나머지 형태가 깨진다.
                  onPress: () => {
                    feedNavRef.current?.goBack();
                    onOpenNotifications?.();
                  },
                  text: '확인',
                },
              ],
            );
            return;
          }
          Alert.alert(
            '게시글 상세를 불러오지 못했어요',
            '잠시 후 다시 시도해 주세요.',
          );
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    commentsLoader,
    currentGroup.id,
    currentMemberId,
    detailLoader,
    loadCommentsPage,
    onOpenNotifications,
    selectedPostId,
  ]);

  const refreshSelectedPost = useCallback(async () => {
    const postId = selectedPostId;
    if (postId === null || isDetailRefreshing) {
      return;
    }

    setIsDetailRefreshing(true);

    const nextDetailRequestId = detailRequestId.current + 1;
    detailRequestId.current = nextDetailRequestId;
    const nextCommentsRequestId = commentsRequestId.current + 1;
    commentsRequestId.current = nextCommentsRequestId;
    commentsLoading.current = commentsLoader !== undefined;

    if (commentsLoader !== undefined) {
      setCommentsState({
        error: null,
        hasNext: false,
        isLoading: true,
        page: 0,
        postId,
      });
    }

    const detailRequest = detailLoader
      ? detailLoader(postId, currentMemberId, currentGroup.id)
          .then(post => {
            if (post.groupId !== currentGroup.id) {
              throw new Error('The post belongs to a different group.');
            }
            if (
              selectedPostId === postId &&
              detailRequestId.current === nextDetailRequestId
            ) {
              interactionsRef.current.setCommentCount(
                post.id,
                post.commentCount,
              );
              setDetailPost(post);
            }
          })
          .catch(error => {
            if (
              selectedPostId === postId &&
              detailRequestId.current === nextDetailRequestId
            ) {
              if (
                detailEntrySourceRef.current === 'notification' &&
                (error instanceof ApiError &&
                  (error.status === 403 || error.status === 404))
              ) {
                Alert.alert(
                  '게시글을 볼 수 없어요',
                  '작성자가 게시글을 삭제했거나 더 이상 볼 수 없습니다.',
                  [
                    {
                      // 최초 조회 실패와 같은 2단 복귀다. 두 호출이 각각
                      // 담당하는 진입 경로는 위 상세 로드 effect의 주석에 있다.
                      onPress: () => {
                        feedNavRef.current?.goBack();
                        onOpenNotifications?.();
                      },
                      text: '확인',
                    },
                  ],
                );
                return;
              }
              Alert.alert(
                '게시글 상세를 불러오지 못했어요',
                error instanceof Error
                  ? error.message
                  : '?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??',
              );
            }
          })
      : Promise.resolve();

    const commentsRequest = commentsLoader
      ? commentsLoader(postId, 0, COMMENT_PAGE_SIZE)
          .then(result => {
            if (
              commentsRequestId.current !== nextCommentsRequestId ||
              selectedPostId !== postId
            ) {
              return;
            }
            interactionsRef.current.replaceComments(
              postId,
              result.comments,
              true,
            );
            setCommentsState({
              error: null,
              hasNext: result.hasNext,
              isLoading: false,
              page: 0,
              postId,
            });
          })
          .catch(error => {
            if (
              commentsRequestId.current !== nextCommentsRequestId ||
              selectedPostId !== postId
            ) {
              return;
            }
            setCommentsState({
              error:
                error instanceof Error
                  ? error.message
                  : '?볤???遺덈윭?ㅼ? 紐삵뻽?듬땲?? ?ㅼ떆 ?쒕룄??二쇱꽭??',
              hasNext: false,
              isLoading: false,
              page: 0,
              postId,
            });
          })
      : Promise.resolve();

    await Promise.allSettled([detailRequest, commentsRequest]);

    if (commentsRequestId.current === nextCommentsRequestId) {
      commentsLoading.current = false;
    }
    if (
      detailRequestId.current === nextDetailRequestId &&
      commentsRequestId.current === nextCommentsRequestId
    ) {
      setIsDetailRefreshing(false);
    }
  }, [
    commentsLoader,
    currentGroup.id,
    currentMemberId,
    detailLoader,
    isDetailRefreshing,
    onOpenNotifications,
    selectedPostId,
  ]);

  useEffect(() => {
    onFullscreenChange?.(isComposerFocused);

    return () => onFullscreenChange?.(false);
  }, [isComposerFocused, onFullscreenChange]);

  // 셸 헤더는 탭 네비게이터 위에 일반 흐름으로 놓여 있어 마운트·언마운트가
  // 아래 내용을 헤더 높이만큼 밀어낸다. useEffect로 알리면 상세 화면이 이미
  // 그려진 뒤에 셸 헤더가 사라져, 두 헤더가 함께 보이는 프레임에서 화면이
  // 덜컹인다. useLayoutEffect는 그리기 전에 실행돼 전환이 한 프레임에 끝난다.
  useLayoutEffect(() => {
    onHeaderVisibilityChange?.(!selectedPostId);
  }, [onHeaderVisibilityChange, selectedPostId]);

  useLayoutEffect(
    () => () => onHeaderVisibilityChange?.(true),
    [onHeaderVisibilityChange],
  );

  const closeReactionPicker = () => setOpenReactionPicker(null);

  // 상세 라우트 마운트 동기화 콜백. cleanup(onClosed)이 기존 하드웨어 백
  // 핸들러의 정리를 대체한다 — 상세의 뒤로가기는 이제 스택 pop이 담당한다
  // (컨테이너 useBackButton이 최심 포커스 스택을 pop).
  const handleDetailRouteOpened = useCallback((postId: string) => {
    setSelectedPostId(postId);
    // 열려 있던 상세의 postId가 딥링크로 교체되는 경우(기존 신호 소비와 동일
    // 시점) 반응 피커가 이전 게시글 것을 가리키지 않게 닫는다.
    setOpenReactionPicker(null);
  }, []);
  const handleDetailRouteClosed = useCallback(() => {
    setSelectedPostId(null);
    setMenuPostId(null);
    setOpenReactionPicker(null);
  }, []);

  const handleToggleReactionPicker = (
    postId: string,
    anchor: ReactionAnchor,
  ) => {
    setOpenReactionPicker(current =>
      current?.postId === postId ? null : {anchor, postId},
    );
  };

  const handleSelectReaction = (
    postId: string,
    reactionId: ChangeReactionInput['nextReactionId'],
  ) => {
    if (
      !reactionId ||
      !resolvedCurrentUser ||
      pendingReactionPostIds.current.has(postId)
    ) {
      return;
    }

    const previousReactionId =
      interactions.selectedReactionByPostId[postId] ?? null;
    const previousReactions =
      interactions.reactionsByPostId[postId] ?? [];
    const nextReactionId =
      previousReactionId === reactionId ? null : reactionId;
    pendingReactionPostIds.current.add(postId);
    Vibration.vibrate(previousReactionId === reactionId ? 6 : 10);
    interactions.changeReaction(postId, reactionId);
    const input: ChangeReactionInput = {
      nextReactionId,
      postId,
      previousReactionId,
    };
    closeReactionPicker();

    if (onChangeReaction === undefined) {
      pendingReactionPostIds.current.delete(postId);
      return;
    }

    void Promise.resolve()
      .then(() => onChangeReaction(input))
      .then(result => {
        if (result === undefined || result.postId !== postId) {
          return;
        }
        interactionsRef.current.setReaction(
          postId,
          result.reactionType,
          result.reactions,
        );
      })
      .catch(error => {
        interactionsRef.current.setReaction(
          postId,
          previousReactionId,
          previousReactions,
        );
        Alert.alert(
          '반응을 저장하지 못했습니다',
          error instanceof Error
            ? error.message
            : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        );
      })
      .finally(() => {
        pendingReactionPostIds.current.delete(postId);
      });
  };

  const handleOpenPost = (postId: string) => {
    closeReactionPicker();
    feedNavRef.current?.navigate('PostDetail', {
      groupId: currentGroup.id,
      postId,
    });
  };

  const handleCreateComment = async (
    input: CreateCommentInput,
  ): Promise<void> => {
    if (!resolvedCurrentUser) {
      return;
    }

    const localCommentId = `local-comment-${nextLocalCommentId.current++}`;
    interactions.addComment(
      input.postId,
      input.body,
      resolvedCurrentUser,
      {commentId: localCommentId},
    );
    if (onCreateComment === undefined) {
      interactionsRef.current.settleCommentCountDelta(input.postId, 1);
      return;
    }

    try {
      const result = await onCreateComment(input);
      if (result === undefined) {
        interactionsRef.current.settleCommentCountDelta(input.postId, 1);
        return;
      }
      interactionsRef.current.replaceComment(
        input.postId,
        {
          // 서버가 준 작성자로 교체한다. 낙관적 항목의 resolvedCurrentUser에는
          // 서버 서명 프로필 URL이 없어 기본 이미지로 보인다.
          // author를 아직 내려주지 않는 서버에서는 기존처럼 화면 값을 유지한다.
          author: result.author ?? resolvedCurrentUser,
          body: result.content,
          createdAt: result.createdAt,
          id: result.id,
          postId: result.postId,
          updatedAt: result.createdAt,
        },
        localCommentId,
      );
      interactionsRef.current.settleCommentCountDelta(input.postId, 1);
    } catch (error) {
      interactionsRef.current.deleteComment(input.postId, localCommentId);
      Alert.alert(
        '댓글을 저장하지 못했습니다',
        error instanceof Error
          ? error.message
          : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
    }
  };

  const handleUpdateComment = async (
    input: UpdateCommentInput,
  ): Promise<void> => {
    const previousComment = interactions.commentsByPostId[input.postId]?.find(
      comment => comment.id === input.commentId,
    );
    interactions.updateComment(
      input.postId,
      input.commentId,
      input.body,
    );
    if (onUpdateComment === undefined) {
      return;
    }

    try {
      const result = await onUpdateComment(input);
      if (result === undefined) {
        return;
      }
      interactionsRef.current.updateComment(
        input.postId,
        input.commentId,
        result.content,
        result.updatedAt,
      );
    } catch (error) {
      if (previousComment !== undefined) {
        interactionsRef.current.replaceComment(
          input.postId,
          previousComment,
        );
      }
      Alert.alert(
        '댓글을 수정하지 못했습니다',
        error instanceof Error
          ? error.message
          : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      );
    }
  };

  const handleDeleteComment = (input: DeleteCommentInput) => {
    const previousComment = interactions.commentsByPostId[input.postId]?.find(
      comment => comment.id === input.commentId,
    );
    interactions.deleteComment(input.postId, input.commentId);
    if (onDeleteComment === undefined) {
      if (previousComment !== undefined) {
        interactionsRef.current.settleCommentCountDelta(input.postId, -1);
      }
      return;
    }

    void Promise.resolve()
      .then(() => onDeleteComment(input))
      .then(() => {
        if (previousComment !== undefined) {
          interactionsRef.current.settleCommentCountDelta(
            input.postId,
            -1,
          );
        }
      })
      .catch(error => {
        if (previousComment !== undefined) {
          interactionsRef.current.restoreComment(
            input.postId,
            previousComment,
          );
        }
        Alert.alert(
          '댓글을 삭제하지 못했습니다',
          error instanceof Error
            ? error.message
            : '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        );
      });
  };

  const submitComposerPayload = async (payload: PostSubmitPayload) => {
    if (onSubmitPost === undefined) {
      Alert.alert(
        'API 연결 전 단계예요',
        '작성·수정 데이터와 콜백 호출까지 준비됐습니다.',
      );
      return;
    }
    if (
      uploadState.status === 'preparing' ||
      uploadState.status === 'uploading'
    ) {
      return;
    }

    pendingUploadPayload.current = payload;
    const controller = new AbortController();
    uploadAbortController.current = controller;
    setUploadState({status: 'preparing'});
    try {
      await onSubmitPost(
        payload,
        progress => setUploadState({progress, status: 'uploading'}),
        controller.signal,
      );
      if (controller.signal.aborted) {
        return;
      }
      // 같은 커밋에 popToTop으로 작성 화면이 언마운트되므로 success 카드는
      // 보이지 않는다(기존 동작 동일). idle로 되돌려야 다음 작성 진입에서
      // 이전 업로드의 완료 카드가 잔존하지 않는다.
      setUploadState({status: 'idle'});
      pendingUploadPayload.current = null;
      // 작성·수정 완료 시 상세까지 닫고 목록으로 돌아간다(기존 동작).
      // 미러 정리는 라우트 unmount cleanup이 이어받는다.
      feedNavRef.current?.dispatch(StackActions.popToTop());
      feed.retry();
    } catch (error) {
      if (
        (controller.signal.aborted &&
          pendingUploadPayload.current !== payload) ||
        (isUploadCancelled(error) && pendingUploadPayload.current !== payload)
      ) {
        return;
      }
      if (controller.signal.aborted || isUploadCancelled(error)) {
        setUploadState({status: 'cancelled'});
      } else {
        setUploadState({
          message:
            error instanceof Error
              ? error.message
              : '게시글 저장에 실패했습니다. 다시 시도해 주세요.',
          status: 'failure',
        });
      }
    } finally {
      if (uploadAbortController.current === controller) {
        uploadAbortController.current = null;
      }
    }
  };

  const cancelComposer = () => {
    uploadAbortController.current?.abort();
    uploadAbortController.current = null;
    pendingUploadPayload.current = null;
    setUploadState({status: 'idle'});
  };

  const menuPost = posts.find(post => post.id === menuPostId) ?? null;

  const handleEdit = () => {
    if (!menuPost || !menuPost.isOwnedByCurrentUser) {
      return;
    }
    setMenuPostId(null);
    pendingUploadPayload.current = null;
    setUploadState({status: 'idle'});
    composerEditInitialValueRef.current = createEditInitialValue(menuPost);
    feedNavRef.current?.navigate('PostComposer', {
      mode: 'edit',
      postId: menuPost.id,
    });
  };

  const handleDelete = () => {
    if (
      !menuPost ||
      !menuPost.isOwnedByCurrentUser ||
      isDeleteConfirmationOpen.current ||
      isDeleteSubmitting.current
    ) {
      return;
    }

    const postId = menuPost.id;
    setMenuPostId(null);
    isDeleteConfirmationOpen.current = true;
    Alert.alert(
      '게시글을 삭제할까요?',
      '삭제한 게시글은 다시 복구할 수 없어요.',
      [
        {
          onPress: () => {
            isDeleteConfirmationOpen.current = false;
          },
          style: 'cancel',
          text: '취소',
        },
        {
          onPress: () => {
            isDeleteConfirmationOpen.current = false;
            if (!onConfirmDelete) {
              Alert.alert(
                '삭제 API 연결 전 단계예요',
                '삭제 확인 콜백만 호출하며 피드 데이터는 유지합니다.',
              );
              return;
            }
            isDeleteSubmitting.current = true;
            Promise.resolve()
              .then(() => onConfirmDelete(postId))
              .then(() => {
                feed.retry();
                feedNavRef.current?.dispatch(StackActions.popToTop());
              })
              .catch(() => {
                Alert.alert(
                  '삭제 요청을 처리하지 못했어요',
                  '게시글은 피드에 그대로 유지됩니다.',
                );
              })
              .finally(() => {
                isDeleteSubmitting.current = false;
              });
          },
          style: 'destructive',
          text: '삭제',
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          isDeleteConfirmationOpen.current = false;
        },
      },
    );
  };

  return (
    <View style={styles.feedRoot}>
      <FeedStack.Navigator
        screenOptions={{animation: 'none', headerShown: false}}
      >
        <FeedStack.Screen name="FeedHome">
          {({navigation}) => {
            // 이동 함수가 effect·핸들러에서도 스택을 조작할 수 있게 렌더 중
            // ref로 캡처한다(AppShell shellNavRef 관용구). 세 화면 모두 캡처 —
            // 중첩 params로 상세·작성이 초기 화면이 될 수 있다.
            feedNavRef.current = navigation;
            return (
              <View style={styles.feedRoot}>
                <RouteFocusReporter onFocusChange={setIsHomeFocused} />
                {feed.status === 'loading' ? (
                  <View
                    accessibilityLabel="피드 불러오는 중"
                    style={styles.centered}
                  >
                    <ActivityIndicator color={COLORS.purple} size="large" />
                  </View>
                ) : feed.status === 'error' ? (
                  <View accessibilityLiveRegion="polite" style={styles.centered}>
                    <AppText style={styles.errorText}>{feed.message}</AppText>
                    <RetryButton onPress={feed.retry} />
                  </View>
                ) : (
                  <>
                    <FlatList
                      contentContainerStyle={[
                        styles.listContent,
                        feed.posts.length === 0 && styles.emptyListContent,
                      ]}
                      contentInsetAdjustmentBehavior="automatic"
                      data={feed.posts}
                      keyExtractor={post => post.id}
                      ListEmptyComponent={<EmptyFeedState />}
                      ListFooterComponent={
                        feed.isLoadingMore ? (
                          <ActivityIndicator
                            color={COLORS.purple}
                            style={styles.listFooter}
                          />
                        ) : null
                      }
                      onEndReached={feed.loadMore}
                      onEndReachedThreshold={0.5}
                      onScrollBeginDrag={closeReactionPicker}
                      onRefresh={feed.refresh}
                      refreshing={feed.isRefreshing}
                      onViewableItemsChanged={handleViewablePostsChanged}
                      renderItem={({item}) => {
                        const reactions =
                          interactions.reactionsByPostId[item.id] ??
                          item.reactions;

                        return (
                          <FeedItem
                            canInteract={canInteract}
                            commentCount={
                              interactions.commentCountByPostId[item.id] ??
                              item.commentCount
                            }
                            // 홈이 상세·작성 아래에서 마운트 유지되므로 포커스로
                            // 게이트해 백그라운드 영상 재생을 막는다(기존 언마운트 등가).
                            isVisible={
                              isHomeFocused && visiblePostIds.has(item.id)
                            }
                            isReactionPickerOpen={
                              openReactionPicker?.postId === item.id
                            }
                            onPress={handleOpenPost}
                            onPressAuthor={handlePressAuthor}
                            onSelectReaction={handleSelectReaction}
                            onToggleReactionPicker={handleToggleReactionPicker}
                            post={{...item, reactions}}
                            selectedReactionId={
                              interactions.selectedReactionByPostId[item.id] ??
                              null
                            }
                          />
                        );
                      }}
                      showsVerticalScrollIndicator={false}
                    />
                    {isHomeFocused ? (
                      <ReactionPopover
                        anchor={
                          openReactionPicker?.anchor ?? {
                            height: 0,
                            width: 0,
                            x: 0,
                            y: 0,
                          }
                        }
                        onClose={closeReactionPicker}
                        onSelect={reactionId => {
                          if (openReactionPicker) {
                            handleSelectReaction(
                              openReactionPicker.postId,
                              reactionId,
                            );
                          }
                        }}
                        selectedReactionId={
                          openReactionPicker
                            ? interactions.selectedReactionByPostId[
                                openReactionPicker.postId
                              ] ?? null
                            : null
                        }
                        visible={openReactionPicker !== null}
                      />
                    ) : null}
                  </>
                )}
              </View>
            );
          }}
        </FeedStack.Screen>
        <FeedStack.Screen name="PostDetail">
          {({navigation, route}) => {
            feedNavRef.current = navigation;
            const {postId} = route.params;
            detailEntrySourceRef.current = route.params.entrySource ?? 'feed';
            const detailSync = (
              <DetailRouteSync
                onClosed={handleDetailRouteClosed}
                onOpened={handleDetailRouteOpened}
                postId={postId}
              />
            );
            const selectedPost =
              detailPost?.id === postId
                ? detailPost
                : posts.find(post => post.id === postId) ?? null;

            if (selectedPost === null) {
              // 목록에 없는 게시글 딥링크: detailLoader 응답까지 로딩을 보여준다.
              return (
                <View
                  accessibilityLabel="게시글 상세 불러오는 중"
                  style={styles.centered}
                >
                  {detailSync}
                  <ActivityIndicator color={COLORS.purple} size="large" />
                </View>
              );
            }

            const comments =
              interactions.commentsByPostId[selectedPost.id] ?? [];
            const reactions =
              interactions.reactionsByPostId[selectedPost.id] ??
              selectedPost.reactions;
            const selectedReactionId =
              interactions.selectedReactionByPostId[selectedPost.id] ?? null;

            return (
              <View style={styles.feedRoot}>
                {detailSync}
                <PostDetailScreen
                  canInteract={canInteract}
                  commentCount={
                    interactions.commentCountByPostId[selectedPost.id] ??
                    selectedPost.commentCount
                  }
                  comments={comments}
                  commentsError={commentsState.error}
                  commentsHasNext={commentsState.hasNext}
                  currentGroupName={currentGroup.name}
                  currentUser={resolvedCurrentUser}
                  isCommentsLoading={commentsState.isLoading}
                  isRefreshing={isDetailRefreshing}
                  isReactionPickerOpen={
                    openReactionPicker?.postId === selectedPost.id
                  }
                  onBack={() => navigation.goBack()}
                  onCreateComment={handleCreateComment}
                  onDeleteComment={handleDeleteComment}
                  onLoadMoreComments={() => {
                    if (
                      selectedPostId !== null &&
                      commentsState.hasNext &&
                      !commentsState.isLoading
                    ) {
                      loadCommentsPage(
                        selectedPostId,
                        commentsState.page + 1,
                        false,
                      );
                    }
                  }}
                  onMenuPress={() => setMenuPostId(selectedPost.id)}
                  onOpenNotifications={onOpenNotifications}
                  unreadNotificationCount={unreadNotificationCount}
                  onPressAuthor={handlePressAuthor}
                  onScrollBeginDrag={closeReactionPicker}
                  onRetryComments={() => {
                    if (selectedPostId !== null) {
                      loadCommentsPage(selectedPostId, 0, true);
                    }
                  }}
                  onRefresh={() => {
                    void refreshSelectedPost();
                  }}
                  onSelectReaction={handleSelectReaction}
                  onToggleReactionPicker={handleToggleReactionPicker}
                  onUpdateComment={handleUpdateComment}
                  post={selectedPost}
                  reactions={reactions}
                  selectedReactionId={selectedReactionId}
                />
                <PostActionsSheet
                  isOpen={menuPost?.id === selectedPost.id}
                  onClose={() => setMenuPostId(null)}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
                <ReactionPopover
                  anchor={
                    openReactionPicker?.anchor ?? {
                      height: 0,
                      width: 0,
                      x: 0,
                      y: 0,
                    }
                  }
                  onClose={closeReactionPicker}
                  onSelect={reactionId =>
                    handleSelectReaction(selectedPost.id, reactionId)
                  }
                  selectedReactionId={selectedReactionId}
                  visible={openReactionPicker?.postId === selectedPost.id}
                />
              </View>
            );
          }}
        </FeedStack.Screen>
        <FeedStack.Screen name="PostComposer">
          {({navigation, route}) => {
            feedNavRef.current = navigation;
            return (
              <>
                <RouteFocusReporter onFocusChange={setIsComposerFocused} />
                <PostComposerScreen
                  initialValue={
                    route.params.mode === 'edit'
                      ? composerEditInitialValueRef.current ?? undefined
                      : undefined
                  }
                  mode={route.params.mode}
                  onCancel={() => {
                    cancelComposer();
                    navigation.goBack();
                  }}
                  onRetryUpload={() => {
                    if (pendingUploadPayload.current !== null) {
                      void submitComposerPayload(pendingUploadPayload.current);
                    }
                  }}
                  onSubmit={payload => void submitComposerPayload(payload)}
                  uploadState={uploadState}
                />
              </>
            );
          }}
        </FeedStack.Screen>
        {/* 셸이 소유하는 공유 하위 화면(알림·보관함). 이 파일은 라우트 등록과
            닫기 바인딩만 담당하고 본문은 셸이 주입하므로, 피처끼리 직접
            import하지 않는다(S15P11B104-367).
            닫기를 goBack 한 번으로 수렴시켜 진입 지점으로 돌아간다.
            feedNavRef는 여기서 캡처하지 않는다 — 상세·작성의 goBack·popToTop이
            하위 화면의 navigation을 잡으면 엉뚱한 화면을 pop한다.
            onClosed로 목록을 다시 조회한다: 하위 화면이 스택 아래 FeedHome을
            마운트 유지하므로 재마운트 재조회가 사라지는데, 알림에서 새 게시글을
            확인하고 닫았을 때 그 글이 보이는 기존 동작은 지켜야 한다.
            retry가 아니라 refresh다 — retry는 status를 loading으로 되돌려
            FlatList를 스피너로 교체하므로, 마운트 유지로 얻은 스크롤 위치가
            그대로 사라진다.
            가입 승인 대기는 게시글을 바꾸지 않으므로 재조회하지 않는다. */}
        {SHARED_SUB_ROUTES.map(route => (
          <FeedStack.Screen key={route} name={route}>
            {({navigation}) =>
              renderSharedSubRoute?.(route, {
                onClose: () => navigation.goBack(),
                onClosed:
                  route === 'joinApproval' ? undefined : feed.refresh,
              }) ?? null
            }
          </FeedStack.Screen>
        ))}
      </FeedStack.Navigator>
      {authorProfilePopup}
    </View>
  );
}

function isUploadCancelled(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'UPLOAD_CANCELLED'
  );
}

function EmptyFeedState() {
  return (
    <View accessibilityLabel="게시물이 없는 피드" style={styles.emptyState}>
      <AppText style={styles.emptyText}>
        아직 공유된 일상이 없어요.{'\n'}
        사랑하는 가족에게 오늘의{'\n'}
        이야기를 전해보세요.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 72,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#5C5752',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  feedRoot: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  listContent: {
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  listFooter: {
    paddingVertical: 16,
  },
});
