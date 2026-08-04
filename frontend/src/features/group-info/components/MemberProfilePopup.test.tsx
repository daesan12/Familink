import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {getCurrentWeekRange} from '../rankingModel';
import type {GroupMember} from '../types';
import {MemberProfilePopup} from './MemberProfilePopup';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('../../../assets/images/carnation.png', () => 1, {virtual: true});

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

const week = getCurrentWeekRange(new Date());

const guardianMember: GroupMember = {
  age: null,
  alias: null,
  avatarText: '홍',
  gender: null,
  isManager: false,
  memberId: 'm-1',
  name: '홍길동',
  role: 'guardian',
};

function createLoaders() {
  return {
    memberCarnationLoader: jest.fn().mockResolvedValue({
      earnedDates: [week.weekStart],
      endDate: week.weekEnd,
      memberId: 'm-1',
      startDate: week.weekStart,
    }),
    memberProfileLoader: jest.fn().mockResolvedValue({
      age: 45,
      displayName: '홍길동',
      gender: 'male' as const,
      memberId: 'm-1',
    }),
    membersLoader: jest.fn().mockResolvedValue([guardianMember]),
    rankingLoader: jest.fn().mockResolvedValue({
      rankings: [
        {
          carnationCount: 3,
          displayName: '홍길동',
          memberId: 'm-1',
          previousWeekWinner: true,
        },
      ],
      weekEnd: week.weekEnd,
      weekStart: week.weekStart,
    }),
  };
}

async function renderPopup(
  loaders: ReturnType<typeof createLoaders>,
  onClose = jest.fn(),
) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <MemberProfilePopup
        groupId="g-1"
        initialMember={{avatarText: '홍', memberId: 'm-1', name: '홍길동'}}
        memberId="m-1"
        onClose={onClose}
        {...loaders}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function textShown(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const children: unknown = node.props.children;
    const text = Array.isArray(children) ? children.join('') : children;
    return text === value;
  });
}

test('구성원·프로필·도장·랭킹을 병렬 조회해 그룹정보와 같은 팝업으로 머지한다', async () => {
  const loaders = createLoaders();
  const renderer = await renderPopup(loaders);

  expect(textShown(renderer, '홍길동 님')).toBe(true);
  expect(textShown(renderer, '만 45세')).toBe(true);
  expect(
    renderer.root.findByProps({accessibilityLabel: '순위 1위'}),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({accessibilityLabel: '이번 주 1위'}),
  ).toBeTruthy();
  expect(
    renderer.root.findByProps({
      accessibilityLabel: '일주일 도장 현황, 이번 주 1/7일 적립',
    }),
  ).toBeTruthy();
  expect(loaders.memberCarnationLoader).toHaveBeenCalledWith(
    'g-1',
    'm-1',
    week.weekStart,
    week.weekEnd,
  );
});

test('프로필 조회가 실패하면 에러를 보여주고 다시 시도로 복구한다', async () => {
  const loaders = createLoaders();
  loaders.memberProfileLoader.mockRejectedValueOnce(new Error('network'));
  const renderer = await renderPopup(loaders);

  expect(
    textShown(renderer, '프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
  ).toBe(true);

  await TestRenderer.act(async () => {
    renderer.root
      .findByProps({accessibilityLabel: '프로필 정보 다시 시도'})
      .props.onPress();
  });

  expect(textShown(renderer, '만 45세')).toBe(true);
});

test('랭킹 조회 실패는 무시하고 나머지 정보를 그대로 보여준다', async () => {
  const loaders = createLoaders();
  loaders.rankingLoader.mockRejectedValueOnce(new Error('network'));
  const renderer = await renderPopup(loaders);

  expect(textShown(renderer, '홍길동 님')).toBe(true);
  expect(textShown(renderer, '만 45세')).toBe(true);
  expect(
    renderer.root.findAllByProps({accessibilityLabel: '순위 1위'}),
  ).toHaveLength(0);
});
