import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {ArchiveLoader, ArchiveQuery} from '../api/archiveApi';
import type {ArchiveMember, ArchivePost} from '../types';
import {ArchiveScreen} from './ArchiveScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
};

// 상호작용 검증용 데이터. 여러 날짜·미디어 타입과 게시글 없는 구성원을 포함한다.
const MEMBERS: readonly ArchiveMember[] = [
  {avatarText: '가', id: 'm-a', name: '가가가'},
  {avatarText: '나', id: 'm-b', name: '나나나'},
  {avatarText: '다', id: 'm-c', name: '다다다'},
];
const POSTS: readonly ArchivePost[] = [
  {
    dateKey: '2026-07-17',
    groupId: 'group-1',
    id: 'p1',
    mediaKind: 'image',
    memberId: 'm-a',
    postId: 'feed-post-1',
    thumbnailAccessibilityLabel: '사진 1',
  },
  {
    dateKey: '2026-07-14',
    groupId: 'group-1',
    id: 'p2',
    mediaKind: 'video',
    memberId: 'm-a',
    postId: 'feed-post-2',
    thumbnailAccessibilityLabel: '영상 1',
  },
  {
    dateKey: '2026-07-14',
    groupId: 'group-1',
    id: 'p3',
    mediaKind: 'text',
    memberId: 'm-b',
    postId: 'feed-post-3',
    text: '안녕하세요',
  },
];

// NavigationContainer로 감싸지 않는 것이 계약이다. 이 화면은 내비게이션 훅을
// 갖지 않고 onCloseArchive·onOpenPost prop만 받으며, 렌더 위치(셸 스택 / 피드 탭
// 스택)를 모른다(S15P11B104-367). 누군가 useNavigation·useIsFocused를 추가하면
// 컨텍스트 부재로 이 파일 전체가 즉시 실패해 위상 결합이 들어오는 것을 막는다.
const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function renderArchive(
  props?: {members?: readonly ArchiveMember[]; posts?: readonly ArchivePost[]},
) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        initialMembers={props?.members ?? MEMBERS}
        initialPosts={props?.posts ?? POSTS}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  });
}

function press(
  renderer: TestRenderer.ReactTestRenderer,
  accessibilityLabel: string,
) {
  const target = renderer.root.findByProps({accessibilityLabel});
  TestRenderer.act(() => {
    target.props.onPress();
  });
}

test('기본 상태에서 날짜별 묶음을 보여준다', () => {
  const renderer = renderArchive();

  expect(hasText(renderer, '2026년 7월 17일')).toBe(true);
  expect(hasText(renderer, '2026년 7월 14일')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '구성원 필터: 모두'}),
  ).toBeTruthy();
});

test('구성원 필터를 적용하면 해당 구성원의 게시글만 남는다', () => {
  const renderer = renderArchive();

  press(renderer, '구성원 필터: 모두');
  press(renderer, '나나나');

  // 나나나는 14일에만 게시글이 있다.
  expect(hasText(renderer, '2026년 7월 14일')).toBe(true);
  expect(hasText(renderer, '2026년 7월 17일')).toBe(false);
});

test('게시글이 없는 구성원을 선택하면 빈 상태를 안내한다', () => {
  const renderer = renderArchive();

  press(renderer, '구성원 필터: 모두');
  press(renderer, '다다다');

  expect(hasText(renderer, '다다다님이 작성한 게시글이 없어요')).toBe(true);
});

test('달력에서 날짜를 선택하면 해당 날짜의 게시글만 모아 보여준다', () => {
  const renderer = renderArchive();

  press(renderer, '날짜로 찾기');
  press(renderer, '7월 17일 게시글 보기');

  expect(hasText(renderer, '2026년 7월 17일')).toBe(true);
  expect(hasText(renderer, '2026년 7월 14일')).toBe(false);

  // 날짜 필터 칩을 해제하면 전체 날짜가 다시 보인다.
  press(renderer, '날짜 필터 2026년 7월 17일 해제');
  expect(hasText(renderer, '2026년 7월 14일')).toBe(true);
});

test('날짜 필터 적용 후 구성원을 바꾸면 날짜 필터가 초기화된다', () => {
  const renderer = renderArchive();

  press(renderer, '날짜로 찾기');
  press(renderer, '7월 17일 게시글 보기');
  expect(hasText(renderer, '2026년 7월 14일')).toBe(false);

  press(renderer, '구성원 필터: 모두');
  press(renderer, '나나나');

  expect(
    renderer.root.findByProps({accessibilityLabel: '구성원 필터: 나나나'}),
  ).toBeTruthy();
  // 나나나는 14일에 게시글이 있어, 날짜 필터가 풀렸음을 확인한다.
  expect(hasText(renderer, '2026년 7월 14일')).toBe(true);
});

test('썸네일을 누르면 해당 게시글 상세로 이동하는 콜백을 호출한다', () => {
  const onOpenPost = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        initialMembers={MEMBERS}
        initialPosts={POSTS}
        onOpenPost={onOpenPost}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '사진 1');

  expect(onOpenPost).toHaveBeenCalledWith('feed-post-1', 'group-1');
});

test('뒤로가기 버튼을 누르면 피드로 돌아가는 콜백을 호출한다', () => {
  const onCloseArchive = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        initialMembers={MEMBERS}
        initialPosts={POSTS}
        onCloseArchive={onCloseArchive}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '보관함 닫기');

  expect(onCloseArchive).toHaveBeenCalledTimes(1);
});

test('기본 목업은 메인 피드와 동일하게 김민수 없이 각 구성원의 게시글을 보여준다', () => {
  // 초기 props 없이 렌더하면 개발용 목업(피드와 동일한 구성)을 사용한다.
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(<ArchiveScreen {...baseProps} />);
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '구성원 필터: 모두');

  expect(
    renderer!.root.findAllByProps({accessibilityLabel: '홍유라'}),
  ).not.toHaveLength(0);
  // 게시글이 없는 가족 구성원도 드롭다운에 노출된다.
  expect(
    renderer!.root.findAllByProps({accessibilityLabel: '강다영'}),
  ).not.toHaveLength(0);
  expect(
    renderer!.root.findAllByProps({accessibilityLabel: '김민수'}),
  ).toHaveLength(0);
  // 장대산이 올린 글이 그대로 노출된다.
  expect(hasText(renderer!, '할머니 사랑해요!! 내가 진짜 사랑해!!')).toBe(true);

  // 게시글이 없는 가족 구성원을 누르면 안내 문구가 뜬다.
  press(renderer!, '강다영');
  expect(hasText(renderer!, '강다영님이 작성한 게시글이 없어요')).toBe(true);
});

test('원격 보관함과 구성원 API를 사용하고 필터를 서버에 전달한다', async () => {
  const archiveLoader = jest.fn().mockResolvedValue([
    {
      dateKey: '2026-08-01',
      groupId: 'group-1',
      id: 'group-1-11',
      mediaKind: 'text',
      memberId: null,
      postId: '11',
      text: '원격 게시글',
    } satisfies ArchivePost,
  ]);
  const membersLoader = jest.fn().mockResolvedValue(MEMBERS);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        archiveLoader={archiveLoader}
        membersLoader={membersLoader}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(membersLoader).toHaveBeenCalledWith('group-1');
  expect(archiveLoader).toHaveBeenCalledWith('group-1', {
    date: null,
    memberId: null,
  });
  expect(hasText(renderer!, '원격 게시글')).toBe(true);

  press(renderer!, '구성원 필터: 모두');
  press(renderer!, '나나나');
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(archiveLoader).toHaveBeenLastCalledWith('group-1', {
    date: null,
    memberId: 'm-b',
  });
});

test('원격 보관함 오류를 안내하고 다시 시도할 수 있다', async () => {
  const archiveLoader = jest
    .fn()
    .mockRejectedValueOnce(new Error('보관함 서버 오류'))
    .mockResolvedValueOnce([]);
  const membersLoader = jest.fn().mockResolvedValue(MEMBERS);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        archiveLoader={archiveLoader}
        membersLoader={membersLoader}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  expect(hasText(renderer!, '보관함 서버 오류')).toBe(true);
  press(renderer!, '보관함 다시 시도');
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(archiveLoader).toHaveBeenCalledTimes(2);
  expect(hasText(renderer!, '아직 보관된 게시글이 없어요')).toBe(true);
});

test('날짜 결과를 다시 불러와도 달력에서 다른 날짜로 바로 이동할 수 있다', async () => {
  const makePost = (dateKey: string, postId: string): ArchivePost => ({
    dateKey,
    groupId: 'group-1',
    id: `group-1-${postId}`,
    mediaKind: 'text',
    memberId: null,
    postId,
    text: dateKey,
  });
  const archiveLoader: ArchiveLoader = jest.fn(
    async (_groupId: string, query: ArchiveQuery = {}) => {
      if (query.date === '2026-08-01') {
        return [makePost('2026-08-01', '1')];
      }
      if (query.date === '2026-08-02') {
        return [makePost('2026-08-02', '2')];
      }
      return [
        makePost('2026-08-01', '1'),
        makePost('2026-08-02', '2'),
      ];
    },
  );
  const membersLoader = jest.fn().mockResolvedValue(MEMBERS);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        archiveLoader={archiveLoader}
        membersLoader={membersLoader}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '날짜로 찾기');
  press(renderer!, '8월 1일 게시글 보기');
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });
  expect(archiveLoader).toHaveBeenLastCalledWith('group-1', {
    date: '2026-08-01',
    memberId: null,
  });

  press(renderer!, '날짜로 찾기');
  expect(
    renderer!.root.findByProps({accessibilityLabel: '8월 2일 게시글 보기'}),
  ).toBeTruthy();
  press(renderer!, '8월 2일 게시글 보기');
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });

  expect(archiveLoader).toHaveBeenLastCalledWith('group-1', {
    date: '2026-08-02',
    memberId: null,
  });
});

test('날짜 조회 실패 후 재시도해도 달력의 날짜 목록을 유지한다', async () => {
  const makePost = (dateKey: string, postId: string): ArchivePost => ({
    dateKey,
    groupId: 'group-1',
    id: `group-1-${postId}`,
    mediaKind: 'text',
    memberId: null,
    postId,
    text: dateKey,
  });
  let dateAttempt = 0;
  const archiveLoader: ArchiveLoader = jest.fn(
    async (_groupId: string, query: ArchiveQuery = {}) => {
      if (query.date === '2026-08-01') {
        if (dateAttempt++ === 0) {
          throw new Error('날짜 조회 실패');
        }
        return [makePost('2026-08-01', '1')];
      }
      return [
        makePost('2026-08-01', '1'),
        makePost('2026-08-02', '2'),
      ];
    },
  );
  const membersLoader = jest.fn().mockResolvedValue(MEMBERS);
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        archiveLoader={archiveLoader}
        membersLoader={membersLoader}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '날짜로 찾기');
  press(renderer!, '8월 1일 게시글 보기');
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });
  expect(hasText(renderer!, '날짜 조회 실패')).toBe(true);

  press(renderer!, '보관함 다시 시도');
  await TestRenderer.act(async () => {
    await Promise.resolve();
  });

  press(renderer!, '날짜로 찾기');
  expect(
    renderer!.root.findByProps({accessibilityLabel: '8월 2일 게시글 보기'}),
  ).toBeTruthy();
});

test('그룹을 바꾸면 이전 그룹 보관함을 새 그룹 응답 전까지 보여주지 않는다', async () => {
  const groupOnePosts: readonly ArchivePost[] = [
    {
      dateKey: '2026-08-01',
      groupId: 'group-1',
      id: 'group-1-1',
      mediaKind: 'text',
      memberId: null,
      postId: '1',
      text: '첫 번째 그룹 게시글',
    },
  ];
  const groupTwoPosts: readonly ArchivePost[] = [
    {
      dateKey: '2026-08-02',
      groupId: 'group-2',
      id: 'group-2-2',
      mediaKind: 'text',
      memberId: null,
      postId: '2',
      text: '두 번째 그룹 게시글',
    },
  ];
  let resolveGroupTwoPosts!: (
    posts: readonly ArchivePost[],
  ) => void;
  let resolveGroupTwoMembers!: (
    members: readonly ArchiveMember[],
  ) => void;
  const archiveLoader: ArchiveLoader = jest.fn((groupId: string) => {
    if (groupId === 'group-1') {
      return Promise.resolve(groupOnePosts);
    }
    return new Promise(resolve => {
      resolveGroupTwoPosts = resolve;
    });
  });
  const membersLoader: (groupId: string) => Promise<readonly ArchiveMember[]> =
    jest.fn((groupId: string) => {
    if (groupId === 'group-1') {
      return Promise.resolve(MEMBERS);
    }
    return new Promise<readonly ArchiveMember[]>(resolve => {
      resolveGroupTwoMembers = resolve;
    });
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <ArchiveScreen
        {...baseProps}
        archiveLoader={archiveLoader}
        membersLoader={membersLoader}
      />,
    );
    await Promise.resolve();
  });
  mountedRenderers.push(renderer!);
  expect(hasText(renderer!, '첫 번째 그룹 게시글')).toBe(true);

  await TestRenderer.act(async () => {
    renderer!.update(
      <ArchiveScreen
        {...baseProps}
        currentGroup={{id: 'group-2', name: '두 번째 가족', role: 'guardian'}}
        archiveLoader={archiveLoader}
        membersLoader={membersLoader}
      />,
    );
    await Promise.resolve();
  });

  expect(hasText(renderer!, '첫 번째 그룹 게시글')).toBe(false);
  expect(
    renderer!.root.findByProps({accessibilityLabel: '보관함을 불러오는 중'}),
  ).toBeTruthy();

  await TestRenderer.act(async () => {
    resolveGroupTwoPosts(groupTwoPosts);
    resolveGroupTwoMembers(MEMBERS);
    await Promise.resolve();
  });
  expect(hasText(renderer!, '두 번째 그룹 게시글')).toBe(true);
});
