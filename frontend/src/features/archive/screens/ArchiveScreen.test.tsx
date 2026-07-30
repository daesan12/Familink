import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

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

  press(renderer!, '피드로 돌아가기');

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
