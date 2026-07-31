import React from 'react';
import {Alert, Text, TextInput} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {GroupMember, WeeklyRankingSnapshot} from '../types';
import {GroupInfoScreen} from './GroupInfoScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const baseProps = {
  currentGroup: {id: 'group-1', name: '우리 가족', role: 'guardian'} as const,
  role: 'guardian' as const,
};

// 방장(이경호)과 일반 구성원(손수호)을 포함한 목업.
const MEMBERS: readonly GroupMember[] = [
  {
    memberId: 'm-manager',
    name: '이경호',
    alias: null,
    role: 'guardian',
    isManager: true,
    avatarText: '경',
    age: 30,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [true, true, true, false, true, true, false],
  },
  {
    memberId: 'm-dad',
    name: '손수호',
    alias: '아빠',
    role: 'guardian',
    isManager: false,
    avatarText: '수',
    age: 52,
    gender: 'male',
    weeklyRank: 4,
    weeklyStamps: [true, true, false, true, false, false, false],
  },
  {
    memberId: 'm-sister',
    name: '홍유라',
    alias: '여동생',
    role: 'careReceiver',
    isManager: false,
    avatarText: '유',
    age: 24,
    gender: 'female',
    weeklyRank: 3,
    weeklyStamps: [true, false, true, true, false, false, true],
  },
];

// 랭킹 모달을 열지 않는 테스트는 로더를 대기 상태로 둬 마운트 후
// 비동기 setState(act 경고)를 막는다. 랭킹 검증 테스트는 아래에서 해소 로더를 쓴다.
const PENDING_RANKING_LOADER = () =>
  new Promise<WeeklyRankingSnapshot>(() => {});

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  jest.restoreAllMocks();
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach((renderer) => renderer.unmount());
  });
});

function renderScreen(currentMemberId = 'm-manager') {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        {...baseProps}
        currentMemberId={currentMemberId}
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        rankingLoader={PENDING_RANKING_LOADER}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some((node) => {
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

function countDesc(
  renderer: TestRenderer.ReactTestRenderer,
  substring: string,
) {
  return renderer.root.findAll(
    (node) =>
      typeof node.props.accessibilityLabel === 'string' &&
      node.props.accessibilityLabel.includes(substring),
  ).length;
}

function countText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).filter((node) => {
    const children = node.props.children;
    return Array.isArray(children)
      ? children.join('') === value
      : children === value;
  }).length;
}

test('제목과 구성원 수, 호칭·실제 이름을 함께 보여준다', () => {
  const renderer = renderScreen();

  expect(hasText(renderer, '그룹 정보')).toBe(true);
  expect(hasText(renderer, '피보호자 1명, 보호자 2명')).toBe(true);
  // 호칭(아빠)과 실제 이름(손수호)이 모두 노출된다.
  expect(hasText(renderer, '아빠')).toBe(true);
  expect(hasText(renderer, '손수호')).toBe(true);
  // 방장에게는 그룹관리자 태그가 붙는다.
  expect(hasText(renderer, '그룹관리자')).toBe(true);
});

test('호칭이 없는 구성원은 이름을 한 번만 표시한다', () => {
  const renderer = renderScreen();

  // 이경호는 호칭이 없어 실명 라인이 중복되지 않는다.
  expect(countText(renderer, '이경호')).toBe(1);
  // 손수호는 호칭(아빠)이 있어 호칭과 실명이 각각 한 번씩 나온다.
  expect(countText(renderer, '아빠')).toBe(1);
  expect(countText(renderer, '손수호')).toBe(1);
});

test('빈 호칭은 저장 버튼이 비활성이라 저장되지 않는다', () => {
  const renderer = renderScreen();

  press(renderer, '손수호 호칭 수정');
  const input = renderer.root.findByProps({accessibilityLabel: '손수호 호칭 입력'});
  TestRenderer.act(() => {
    input.props.onChangeText('   ');
  });

  const saveButton = renderer.root.findByProps({
    accessibilityLabel: '손수호 호칭 저장',
  });
  expect(saveButton.props.accessibilityState).toEqual({disabled: true});

  press(renderer, '손수호 호칭 저장');

  // 저장되지 않아 기존 호칭(아빠)이 유지되고 편집 모드도 닫히지 않는다.
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);
});

test('연필을 누르면 호칭을 인라인으로 편집하고 저장한다', () => {
  const renderer = renderScreen();

  press(renderer, '손수호 호칭 수정');

  const input = renderer.root.findByProps({accessibilityLabel: '손수호 호칭 입력'});
  expect(input.props.value).toBe('아빠');
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(1);

  TestRenderer.act(() => {
    input.props.onChangeText('아버지');
  });
  press(renderer, '손수호 호칭 저장');

  expect(hasText(renderer, '아버지')).toBe(true);
  // 저장 후 편집 모드가 닫힌다.
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
});

test('방장은 역할 토글로 구성원 역할을 바꿀 수 있다', () => {
  const renderer = renderScreen('m-manager');

  // 손수호를 피보호자로 바꾸면 인원 수 문구가 갱신된다.
  press(renderer, '손수호 피보호자');

  expect(hasText(renderer, '피보호자 2명, 보호자 1명')).toBe(true);
});

test('방장이 아니면 역할 토글 시 안내 팝업을 띄우고 역할을 바꾸지 않는다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = renderScreen('m-dad');

  press(renderer, '손수호 피보호자');

  expect(alertSpy).toHaveBeenCalledWith(
    '역할 변경 권한이 없어요',
    '역할은 그룹 관리자(방장)만 변경할 수 있어요.',
  );
  // 역할은 그대로다.
  expect(hasText(renderer, '피보호자 1명, 보호자 2명')).toBe(true);
});

test('방장이 아니어도 이미 선택된 역할을 누르면 안내 없이 무시한다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = renderScreen('m-dad');

  // 손수호는 이미 보호자다. 같은 역할을 눌러도 변화가 없어 안내하지 않는다.
  press(renderer, '손수호 보호자');

  expect(alertSpy).not.toHaveBeenCalled();
});

test('보호자 프로필 팝업은 정보와 함께 도장·순위·왕관을 보여준다', () => {
  const renderer = renderScreen();

  // 이경호는 보호자 1위(방장)다.
  press(renderer, '이경호 프로필 보기');

  expect(hasText(renderer, '이경호 님')).toBe(true);
  expect(hasText(renderer, '만 30세')).toBe(true);
  expect(hasText(renderer, '남자')).toBe(true);
  // 일주일 도장 현황이 적립 일수 요약과 함께 노출된다(이경호는 5/7일).
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '일주일 도장 현황, 이번 주 5/7일 적립',
    }),
  ).toBeTruthy();
  // 순위 배지와 1위 왕관이 표시된다.
  expect(countDesc(renderer, '순위 1위')).toBeGreaterThan(0);
  expect(
    renderer.root.findByProps({accessibilityLabel: '이번 주 1위'}),
  ).toBeTruthy();

  // 배경을 누르면 닫힌다.
  press(renderer, '프로필 닫기');
  expect(hasText(renderer, '이경호 님')).toBe(false);
});

test('1위가 아닌 보호자 프로필에는 도장은 있지만 왕관은 없다', () => {
  const renderer = renderScreen();

  // 손수호는 보호자 4위라 도장은 보이고 왕관은 없다.
  press(renderer, '손수호 프로필 보기');

  expect(hasText(renderer, '손수호 님')).toBe(true);
  expect(countDesc(renderer, '일주일 도장 현황')).toBeGreaterThan(0);
  expect(countDesc(renderer, '이번 주 1위')).toBe(0);
});

test('피보호자 프로필 팝업은 도장·순위·왕관을 모두 숨긴다', () => {
  const renderer = renderScreen();

  // 홍유라는 피보호자라 효자 랭킹 요소를 표시하지 않는다.
  press(renderer, '홍유라 프로필 보기');

  // 기본 정보는 보인다.
  expect(hasText(renderer, '홍유라 님')).toBe(true);
  expect(hasText(renderer, '만 24세')).toBe(true);
  expect(hasText(renderer, '여자')).toBe(true);
  // 도장·순위 배지·왕관은 모두 없다.
  expect(countDesc(renderer, '일주일 도장 현황')).toBe(0);
  expect(countDesc(renderer, '순위')).toBe(0);
  expect(countDesc(renderer, '이번 주 1위')).toBe(0);
});

const GROUP_A = {id: 'g-a', name: 'A 그룹', role: 'guardian'} as const;
const GROUP_B = {id: 'g-b', name: 'B 그룹', role: 'guardian'} as const;
const MEMBERS_B: readonly GroupMember[] = [
  {
    memberId: 'b-lead',
    name: '박보검',
    alias: null,
    role: 'guardian',
    isManager: true,
    avatarText: '박',
    age: 40,
    gender: 'male',
    weeklyRank: 1,
    weeklyStamps: [false, false, false, false, false, false, false],
  },
];

test('그룹을 바꾸면 그 그룹의 구성원으로 갈아끼운다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        currentGroup={GROUP_A}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        rankingLoader={PENDING_RANKING_LOADER}
        role="guardian"
      />,
    );
  });
  mountedRenderers.push(renderer!);
  expect(hasText(renderer!, '손수호')).toBe(true);

  TestRenderer.act(() => {
    renderer!.update(
      <GroupInfoScreen
        currentGroup={GROUP_B}
        currentMemberId="b-lead"
        initialMembers={MEMBERS_B}
        pendingJoinCount={0}
        rankingLoader={PENDING_RANKING_LOADER}
        role="guardian"
      />,
    );
  });

  expect(hasText(renderer!, '박보검')).toBe(true);
  expect(hasText(renderer!, '손수호')).toBe(false);
});

test('그룹을 바꾸면 편집 중이던 상태가 초기화된다', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        currentGroup={GROUP_A}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        rankingLoader={PENDING_RANKING_LOADER}
        role="guardian"
      />,
    );
  });
  mountedRenderers.push(renderer!);

  // A 그룹에서 호칭 편집을 시작한다.
  press(renderer!, '손수호 호칭 수정');
  expect(renderer!.root.findAllByType(TextInput)).toHaveLength(1);

  // B 그룹으로 전환하면 편집 상태가 사라진다.
  TestRenderer.act(() => {
    renderer!.update(
      <GroupInfoScreen
        currentGroup={GROUP_B}
        currentMemberId="b-lead"
        initialMembers={MEMBERS_B}
        pendingJoinCount={0}
        rankingLoader={PENDING_RANKING_LOADER}
        role="guardian"
      />,
    );
  });
  expect(renderer!.root.findAllByType(TextInput)).toHaveLength(0);
});

// 공동 2위(손수호·홍유라)와 지난주 1위 왕관(홍유라)을 담은 랭킹 목업.
// 필드명은 API-CARNATION-001 응답(rankings/displayName/previousWeekWinner)에 맞춘다.
const RANKING: WeeklyRankingSnapshot = {
  weekStart: '2026-07-20',
  weekEnd: '2026-07-26',
  rankings: [
    {
      memberId: 'r-first',
      displayName: '강다영',
      carnationCount: 5,
      previousWeekWinner: false,
    },
    {
      memberId: 'r-crown',
      displayName: '홍유라',
      carnationCount: 3,
      previousWeekWinner: true,
    },
    {
      memberId: 'r-tie',
      displayName: '손수호',
      carnationCount: 3,
      previousWeekWinner: false,
    },
  ],
};

// 비동기 로더가 성공 상태로 정착할 때까지 flush한 뒤 렌더러를 돌려준다.
async function renderWithRanking(
  snapshot: WeeklyRankingSnapshot = RANKING,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        {...baseProps}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        rankingLoader={() => Promise.resolve(snapshot)}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

test('랭킹 카드를 누르면 주간 효자 랭킹을 순위·날짜와 함께 연다', async () => {
  const renderer = await renderWithRanking();

  // 열기 전에는 모달 내용이 없다.
  expect(hasText(renderer, '주간 효자 랭킹')).toBe(false);

  press(renderer, '이번주 우리 가족 효자 랭킹 조회하기');

  expect(hasText(renderer, '주간 효자 랭킹')).toBe(true);
  expect(hasText(renderer, '2026년 7월 20일 ~ 26일')).toBe(true);
  // 카네이션 5개인 강다영이 1위다.
  expect(
    renderer.root.findByProps({accessibilityLabel: '1위 강다영'}),
  ).toBeTruthy();
});

test('같은 카네이션 수는 공동 순위로, 지난주 1위는 왕관으로 표시한다', async () => {
  const renderer = await renderWithRanking();

  press(renderer, '이번주 우리 가족 효자 랭킹 조회하기');

  // 손수호·홍유라는 카네이션 3개로 공동 2위다. 손수호 행에는 왕관 표시가 없다.
  expect(
    renderer.root.findByProps({accessibilityLabel: '2위 손수호'}),
  ).toBeTruthy();
  // 홍유라는 공동 2위이면서 지난주 1위라 왕관을 단다(라벨에만 왕관 표기가 붙는다).
  expect(
    renderer.root.findByProps({accessibilityLabel: '2위 홍유라, 지난주 1위'}),
  ).toBeTruthy();
  // 1위(강다영)는 지난주 1위가 아니라 왕관 표기가 없다.
  expect(
    renderer.root.findByProps({accessibilityLabel: '1위 강다영'}),
  ).toBeTruthy();
});

test('집계 주간이 비면 깨진 날짜 문구 대신 안내만 보여준다', async () => {
  const renderer = await renderWithRanking({
    weekStart: '',
    weekEnd: '',
    rankings: [],
  });

  press(renderer, '이번주 우리 가족 효자 랭킹 조회하기');

  expect(hasText(renderer, '주간 효자 랭킹')).toBe(true);
  expect(hasText(renderer, '아직 집계된 랭킹이 없어요.')).toBe(true);
  // '이번 주' 날짜 블록과 undefined 섞인 깨진 문구가 노출되지 않는다.
  expect(hasText(renderer, '이번 주')).toBe(false);
  const brokenDate = renderer.root.findAllByType(Text).some((node) => {
    const children = node.props.children;
    const value = Array.isArray(children) ? children.join('') : children;
    return typeof value === 'string' && value.includes('undefined');
  });
  expect(brokenDate).toBe(false);
});

test('뒤로 가기를 누르면 랭킹 모달이 닫힌다', async () => {
  const renderer = await renderWithRanking();

  press(renderer, '이번주 우리 가족 효자 랭킹 조회하기');
  expect(hasText(renderer, '주간 효자 랭킹')).toBe(true);

  press(renderer, '뒤로 가기');
  expect(hasText(renderer, '주간 효자 랭킹')).toBe(false);
});

test('로딩 중에는 랭킹 목록 대신 로딩 표시를 보여준다', () => {
  // renderScreen은 해소되지 않는 로더를 써 로딩 상태에 머문다.
  const renderer = renderScreen();

  press(renderer, '이번주 우리 가족 효자 랭킹 조회하기');

  expect(
    renderer.root.findByProps({accessibilityLabel: '랭킹 불러오는 중'}),
  ).toBeTruthy();
  // 아직 순위 목록은 없다.
  expect(hasText(renderer, '아직 집계된 랭킹이 없어요.')).toBe(false);
});

test('로더 실패 시 에러와 다시 시도를 보여주고, 재시도로 복구한다', async () => {
  // 첫 호출은 실패, 재시도(두 번째 호출)는 성공하는 로더.
  let calls = 0;
  const loader = () => {
    calls += 1;
    return calls === 1
      ? Promise.reject(new Error('실패'))
      : Promise.resolve(RANKING);
  };

  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        {...baseProps}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        pendingJoinCount={2}
        rankingLoader={loader}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '이번주 우리 가족 효자 랭킹 조회하기');

  // 실패 상태: 안내 문구와 다시 시도 버튼이 보인다.
  expect(
    hasText(renderer!, '랭킹을 불러오지 못했어요. 다시 시도해 주세요.'),
  ).toBe(true);
  const retryButton = renderer!.root.findByProps({
    accessibilityLabel: '다시 시도',
  });

  // 다시 시도하면 두 번째 로더 호출이 성공해 순위 목록으로 복구된다.
  await TestRenderer.act(async () => {
    retryButton.props.onPress();
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '1위 강다영'}),
  ).toBeTruthy();
  expect(
    hasText(renderer!, '랭킹을 불러오지 못했어요. 다시 시도해 주세요.'),
  ).toBe(false);
});

test('아직 연동 전인 관리 메뉴 행은 후속 작업 안내 팝업을 띄운다', () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const renderer = renderScreen();

  press(renderer, '그룹관리자 변경');

  expect(alertSpy).toHaveBeenCalledWith(
    '그룹관리자 변경',
    '후속 작업에서 연결될 화면입니다.',
  );
});

test('그룹 코드 카드를 누르면 그룹 코드 화면으로 이동한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        {...baseProps}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        inviteCodeLoader={() => Promise.resolve({inviteCode: '176203'})}
        pendingJoinCount={2}
        rankingLoader={PENDING_RANKING_LOADER}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '그룹 코드');
  // 하위 화면 로더가 해소되도록 flush한다.
  await TestRenderer.act(async () => {});

  expect(hasText(renderer!, '가족을 초대해 보세요')).toBe(true);
  expect(
    renderer!.root.findByProps({accessibilityLabel: '그룹 코드 176203'}),
  ).toBeTruthy();

  // 뒤로 가면 그룹정보로 돌아온다.
  press(renderer!, '뒤로 가기');
  expect(hasText(renderer!, '그룹 정보')).toBe(true);
});

test('가입 승인 대기 카드를 누르면 승인 화면으로 이동한다', async () => {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <GroupInfoScreen
        {...baseProps}
        currentMemberId="m-manager"
        initialMembers={MEMBERS}
        joinRequestsLoader={() =>
          Promise.resolve([
            {
              joinRequestId: 'jr-1',
              applicantUserId: 'u-1',
              applicantName: '손수호',
              profileImageUrl: null,
              status: 'PENDING_ADMIN' as const,
              assignedRole: null,
              processedAt: null,
              createdAt: '2026-07-30T09:12:00Z',
            },
          ])
        }
        pendingJoinCount={2}
        rankingLoader={PENDING_RANKING_LOADER}
      />,
    );
  });
  mountedRenderers.push(renderer!);

  press(renderer!, '가입 승인 대기');
  await TestRenderer.act(async () => {});

  expect(hasText(renderer!, '승인 요청 1건')).toBe(true);
  expect(hasText(renderer!, '손수호')).toBe(true);
});
