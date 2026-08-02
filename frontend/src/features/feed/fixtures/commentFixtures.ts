import type {FeedMember, PostComment} from '../types';

export const DEVELOPMENT_CURRENT_USER: FeedMember = {
  avatarText: '다',
  id: 'member-dayoung',
  name: '다영',
};

export const DEVELOPMENT_COMMENTS_BY_POST_ID: Readonly<
  Record<string, readonly PostComment[]>
> = {
  'post-gyeongju': [
    {
      author: {avatarText: '수', id: 'member-suho', name: '수호'},
      body: '사진만 봐도 또 가고 싶다!',
      createdAt: '2026-07-30T11:42:00Z',
      id: 'comment-gyeongju-1',
      postId: 'post-gyeongju',
    },
    {
      author: DEVELOPMENT_CURRENT_USER,
      body: '다음에는 다 같이 가요 😊',
      createdAt: '2026-07-30T11:45:00Z',
      id: 'comment-gyeongju-2',
      postId: 'post-gyeongju',
    },
  ],
  'post-love': [
    {
      author: {avatarText: '수', id: 'member-suho', name: '수호'},
      body: '대산이 많이 취했네...',
      createdAt: '2026-07-30T05:40:00Z',
      id: 'comment-love-1',
      postId: 'post-love',
    },
    {
      author: {avatarText: '경', id: 'member-gyeongho', name: '경호'},
      body: '캡처해놨어 형',
      createdAt: '2026-07-30T07:40:00Z',
      id: 'comment-love-2',
      postId: 'post-love',
    },
    {
      author: DEVELOPMENT_CURRENT_USER,
      body: '할머니 많이 사랑하는 것 같아서 보기 좋은데여? 굿굿',
      createdAt: '2026-07-30T05:40:00Z',
      id: 'comment-love-3',
      postId: 'post-love',
    },
  ],
  'post-recital': [],
};
