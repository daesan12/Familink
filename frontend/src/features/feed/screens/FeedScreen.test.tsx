import React from 'react';
import {
  NavigationContainer,
  createNavigationContainerRef,
} from '@react-navigation/native';
import TestRenderer from 'react-test-renderer';

import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import {mockHardwareBack} from '../../../shared/testing/hardwareBack';
import type {FeedStackParamList} from '../navigationTypes';
import type {FeedPost, ReactionId} from '../types';
import {FeedScreen} from './FeedScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-safe-area-context', () => {
  const mockReact = jest.requireActual('react');
  const {View} = jest.requireActual('react-native');
  const insets = {bottom: 0, left: 0, right: 0, top: 0};

  return {
    // FeedStack(native-stack)의 SafeAreaProviderCompat이 이 컨텍스트를 구독한다.
    SafeAreaInsetsContext: mockReact.createContext(insets),
    SafeAreaProvider: View,
    SafeAreaView: View,
    initialWindowMetrics: null,
    useSafeAreaInsets: () => insets,
  };
});

// FeedScreen이 내부에 FeedStack 내비게이터를 렌더하므로 컨테이너가 필요하다.
function withNav(element: React.ReactElement) {
  return <NavigationContainer>{element}</NavigationContainer>;
}

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));
jest.mock('../components/ReactionBar', () => {
  const ReactRuntime = require('react');
  const {Pressable, View} = require('react-native');

  return {
    ReactionBar: ({
      onSelectReaction,
      onTogglePicker,
      reactions,
      selectedReactionId,
    }: {
      onSelectReaction: (reactionId: ReactionId) => void;
      onTogglePicker: (anchor: {
        height: number;
        width: number;
        x: number;
        y: number;
      }) => void;
      reactions: FeedPost['reactions'];
      selectedReactionId: FeedPost['currentUserReactionId'];
    }) =>
      ReactRuntime.createElement(
        View,
        null,
        ReactRuntime.createElement(Pressable, {
          accessibilityLabel: '게시글 반응 추가',
          onPress: () =>
            onTogglePicker({height: 44, width: 44, x: 100, y: 200}),
        }),
        selectedReactionId
          ? ReactRuntime.createElement(Pressable, {
              accessibilityLabel: `${
                reactions.find(
                  reaction => reaction.id === selectedReactionId,
                )?.label
              } 반응 ${
                reactions.find(
                  reaction => reaction.id === selectedReactionId,
                )?.count
              }개, 내가 선택함`,
              onPress: () => onSelectReaction(selectedReactionId),
            })
          : null,
      ),
  };
});
jest.mock('../components/ReactionPopover', () => {
  const ReactRuntime = require('react');
  const {Pressable} = require('react-native');

  return {
    ReactionPopover: ({
      onSelect,
      visible,
    }: {
      onSelect: (reactionId: 'HEART') => void;
      visible: boolean;
    }) =>
      visible
        ? ReactRuntime.createElement(Pressable, {
            accessibilityLabel: '사랑해요',
            onPress: () => onSelect('HEART'),
          })
        : null,
  };
});

const post: FeedPost = {
  author: {avatarText: '유', id: 'member-yura', name: '유라'},
  body: '가족 여행 기록',
  commentCount: 0,
  createdAt: '2026-07-30T12:00:00Z',
  groupId: 'group-1',
  id: 'post-1',
  images: [],
  isOwnedByCurrentUser: false,
  reactions: [],
};

test('댓글 작성 직후 서버가 준 작성자 프로필 사진을 보여준다', async () => {
  // 화면이 들고 있는 currentUser에는 프로필 URL이 없다. 서버 서명 URL이라
  // 클라이언트가 만들 수 없으므로 생성 응답의 author로 교체해야 한다.
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  const onCreateComment = jest.fn().mockResolvedValue({
    author: {
      avatarText: '다',
      id: 'current-user',
      name: '다영',
      profileImageUrl: 'https://signed.example/me.jpg',
    },
    content: '새 댓글',
    createdAt: '2026-07-30T13:00:00Z',
    id: 'comment-1',
    postId: 'post-1',
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          onCreateComment={onCreateComment}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  await TestRenderer.act(async () => {
    navRef.navigate('PostDetail', {groupId: 'group-1', postId: 'post-1'});
    await Promise.resolve();
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityLabel: '댓글 입력'})
      .props.onChangeText('새 댓글');
    await Promise.resolve();
  });
  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityLabel: '댓글 등록'})
      .props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onCreateComment).toHaveBeenCalledWith({
    body: '새 댓글',
    postId: 'post-1',
  });
  expect(
    renderer!.root
      .findAllByType(CachedRemoteImage)
      .map(node => node.props.source.uri),
  ).toContain('https://signed.example/me.jpg');

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

test('D-2와 D-3가 같은 postId의 반응 상태를 공유한다', async () => {
  const onChangeReaction = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          onChangeReaction={onChangeReaction}
          role="guardian"
        />,
      ),
      {
        createNodeMock: () => ({
          measureInWindow: (
            callback: (
              x: number,
              y: number,
              width: number,
              height: number,
            ) => void,
          ) => callback(100, 200, 44, 44),
        }),
      },
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  const addReactionButton = renderer!.root
    .findAllByProps({accessibilityLabel: '게시글 반응 추가'})
    .find(node => typeof node.props.onPress === 'function');
  expect(addReactionButton).toBeTruthy();

  await TestRenderer.act(() => {
    addReactionButton!.props.onPress();
  });

  const loveReactionButton = renderer!.root
    .findAllByProps({accessibilityLabel: '사랑해요'})
    .find(node => typeof node.props.onPress === 'function');
  expect(loveReactionButton).toBeTruthy();

  await TestRenderer.act(() => {
    loveReactionButton!.props.onPress();
  });

  expect(onChangeReaction).toHaveBeenCalledWith({
    nextReactionId: 'HEART',
    postId: post.id,
    previousReactionId: null,
  });

  const commentButton = renderer!.root
    .findAllByProps({accessibilityLabel: '댓글 0개 보기'})
    .find(node => typeof node.props.onPress === 'function');
  expect(commentButton).toBeTruthy();

  await TestRenderer.act(() => {
    commentButton!.props.onPress();
  });

  expect(
    renderer!.root.findAllByProps({
      accessibilityLabel: '사랑해요 반응 1개, 내가 선택함',
    }),
  ).not.toHaveLength(0);

  const selectedReactionButton = renderer!.root
    .findAllByProps({
      accessibilityLabel: '사랑해요 반응 1개, 내가 선택함',
    })
    .find(node => typeof node.props.onPress === 'function');
  expect(selectedReactionButton).toBeTruthy();

  await TestRenderer.act(async () => {
    selectedReactionButton!.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(onChangeReaction).toHaveBeenLastCalledWith({
    nextReactionId: null,
    postId: post.id,
    previousReactionId: 'HEART',
  });

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

test('내비게이션으로 전달된 postId의 게시글 상세를 바로 연다', async () => {
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
    await Promise.resolve();
  });

  await TestRenderer.act(async () => {
    navRef.navigate('PostDetail', {groupId: 'group-1', postId: 'post-1'});
    await Promise.resolve();
  });

  expect(
    renderer!.root.findByProps({
      accessibilityLabel: '게시글 닫기',
    }),
  ).toBeTruthy();

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

test('상세에서 하드웨어 뒤로가기는 목록으로 돌아간다', async () => {
  // 상세는 마운트 후에 연다 — 초기 커밋에 열면 jest에서 컨테이너 리스너
  // 등록 순서가 프로덕션과 역전된다.
  const back = mockHardwareBack();
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  let renderer: TestRenderer.ReactTestRenderer;

  try {
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <NavigationContainer ref={navRef}>
          <FeedScreen
            currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
            currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
            initialCommentsByPostId={{'post-1': []}}
            loader={jest.fn().mockResolvedValue([post])}
            role="guardian"
          />
        </NavigationContainer>,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await TestRenderer.act(async () => {
      navRef.navigate('PostDetail', {groupId: 'group-1', postId: 'post-1'});
      await Promise.resolve();
    });
    expect(
      renderer!.root.findByProps({accessibilityLabel: '게시글 닫기'}),
    ).toBeTruthy();

    let handled = false;
    await TestRenderer.act(async () => {
      handled = back.press();
      await Promise.resolve();
    });

    // 컨테이너의 useBackButton이 FeedStack을 pop해 상세를 닫는다.
    expect(handled).toBe(true);
    expect(
      renderer!.root.findAllByProps({accessibilityLabel: '게시글 닫기'}),
    ).toHaveLength(0);

    await TestRenderer.act(() => {
      renderer!.unmount();
    });
  } finally {
    back.restore();
  }
});

test('작성자 아바타를 누르면 그룹정보와 동일한 프로필 팝업을 연다', async () => {
  const membersLoader = jest.fn().mockResolvedValue([
    {
      age: null,
      alias: null,
      avatarText: '유',
      gender: null,
      isManager: false,
      memberId: 'member-yura',
      name: '유라',
      role: 'careReceiver',
    },
  ]);
  const memberProfileLoader = jest.fn().mockResolvedValue({
    age: 70,
    displayName: '유라',
    gender: 'female',
    memberId: 'member-yura',
  });
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      withNav(
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          initialCommentsByPostId={{'post-1': []}}
          loader={jest.fn().mockResolvedValue([post])}
          memberProfileLoader={memberProfileLoader}
          membersLoader={membersLoader}
          role="guardian"
        />,
      ),
    );
  });

  await TestRenderer.act(async () => {
    renderer!.root
      .findByProps({accessibilityLabel: '유라님의 프로필 보기'})
      .props.onPress();
  });

  expect(membersLoader).toHaveBeenCalledWith('group-1');
  expect(memberProfileLoader).toHaveBeenCalledWith('group-1', 'member-yura');
  const {Text} = require('react-native');
  const shown = renderer!.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    return (Array.isArray(children) ? children.join('') : children) === '만 70세';
  });
  expect(shown).toBe(true);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

// 셸이 주입하는 공유 하위 화면(알림·보관함)의 등록 계약 (S15P11B104-367).
// FeedScreen은 라우트를 등록하고 닫기·닫힘 후처리만 바인딩한다.
test('공유 하위 화면을 닫으면 목록으로 돌아오고 피드를 다시 조회한다', async () => {
  // 하위 화면은 셸이 만든다. 여기서는 라우트가 실제로 등록되고 onClose·onClosed가
  // 호출되는지만 본다.
  const loader = jest.fn().mockResolvedValue([post]);
  const navRef = createNavigationContainerRef<FeedStackParamList>();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <NavigationContainer ref={navRef}>
        <FeedScreen
          currentGroup={{id: 'group-1', name: '우리 가족', role: 'guardian'}}
          currentUser={{avatarText: '다', id: 'current-user', name: '다영'}}
          loader={loader}
          renderSharedSubRoute={(route, {onClose, onClosed}) => (
            <SubRouteProbe onClose={onClose} onClosed={onClosed} route={route} />
          )}
          role="guardian"
        />
      </NavigationContainer>,
    );
    await Promise.resolve();
  });

  const loadsAfterMount = loader.mock.calls.length;

  await TestRenderer.act(async () => {
    navRef.navigate('notifications');
  });
  expect(navRef.getCurrentRoute()?.name).toBe('notifications');

  // 화면 자신의 닫기 버튼 → 등록 지점이 바인딩한 navigation.goBack()
  await TestRenderer.act(async () => {
    renderer!.root.findByProps({accessibilityLabel: '닫기'}).props.onPress();
    await Promise.resolve();
  });

  expect(navRef.getCurrentRoute()?.name).toBe('FeedHome');
  // FeedHome이 스택 아래에 마운트 유지되어 재마운트 재조회가 사라지므로, 닫힘
  // 후처리로 목록을 다시 조회한다(알림에서 새 게시글을 확인하고 닫는 경로).
  expect(loader.mock.calls.length).toBeGreaterThan(loadsAfterMount);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});

function SubRouteProbe({
  onClose,
  onClosed,
  route,
}: {
  onClose: () => void;
  onClosed?: () => void;
  route: string;
}) {
  const {Pressable, Text} = require('react-native');
  React.useEffect(() => () => onClosed?.(), [onClosed]);

  return (
    <>
      <Text>{`screen:${route}`}</Text>
      <Pressable accessibilityLabel="닫기" onPress={onClose}>
        <Text>닫기</Text>
      </Pressable>
    </>
  );
}
