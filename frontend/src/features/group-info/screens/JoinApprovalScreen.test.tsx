import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import type {JoinRequest, JoinRequestDecisionInput} from '../types';
import {JoinApprovalScreen} from './JoinApprovalScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const REQUESTS: readonly JoinRequest[] = [
  {
    joinRequestId: 'jr-suho',
    applicantUserId: 'u-suho',
    applicantName: '손수호',
    profileImageUrl: null,
    status: 'PENDING_ADMIN',
    assignedRole: null,
    processedAt: null,
    createdAt: '2026-07-30T09:12:00Z',
  },
  {
    joinRequestId: 'jr-jong',
    applicantUserId: 'u-jong',
    applicantName: '이종철',
    profileImageUrl: null,
    status: 'PENDING_ADMIN',
    assignedRole: null,
    processedAt: null,
    createdAt: '2026-07-30T10:40:00Z',
  },
];

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

function hasText(renderer: TestRenderer.ReactTestRenderer, value: string) {
  return renderer.root.findAllByType(Text).some(node => {
    const children = node.props.children;
    const joined = Array.isArray(children) ? children.join('') : children;
    return joined === value;
  });
}

async function press(renderer: TestRenderer.ReactTestRenderer, label: string) {
  const target = renderer.root.findByProps({accessibilityLabel: label});
  await TestRenderer.act(async () => {
    await target.props.onPress();
  });
}

async function renderScreen(
  requests: readonly JoinRequest[] = REQUESTS,
  onProcess?: (
    groupId: string,
    input: JoinRequestDecisionInput,
  ) => Promise<void>,
) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(
      <JoinApprovalScreen
        groupId="g-1"
        loader={() => Promise.resolve(requests)}
        onBack={() => {}}
        onProcess={onProcess}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

test('대기 중 가입 요청 목록과 건수를 보여준다', async () => {
  const renderer = await renderScreen();

  expect(hasText(renderer, '승인 요청 2건')).toBe(true);
  expect(hasText(renderer, '손수호')).toBe(true);
  expect(hasText(renderer, '이종철')).toBe(true);
});

test('거절하면 해당 카드가 사라지고 건수가 줄어든다', async () => {
  const decisions: JoinRequestDecisionInput[] = [];
  const renderer = await renderScreen(REQUESTS, (_groupId, input) => {
    decisions.push(input);
    return Promise.resolve();
  });

  await press(renderer, '손수호 거절');

  expect(hasText(renderer, '손수호')).toBe(false);
  expect(hasText(renderer, '승인 요청 1건')).toBe(true);
  expect(decisions).toEqual([
    {joinRequestId: 'jr-suho', decision: 'REJECT', assignedRole: undefined},
  ]);
});

test('처리에 실패하면 요청 카드를 유지하고 다시 시도할 수 있다', async () => {
  const renderer = await renderScreen(REQUESTS, async () => {
    throw new Error('network');
  });

  await press(renderer, '손수호 거절');

  expect(hasText(renderer, '손수호')).toBe(true);
  expect(
    hasText(
      renderer,
      '가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    ),
  ).toBe(true);
});

test('승인하면 역할 선택 모달을 열고, 역할을 고르면 카드가 사라진다', async () => {
  const decisions: JoinRequestDecisionInput[] = [];
  const renderer = await renderScreen(REQUESTS, (_groupId, input) => {
    decisions.push(input);
    return Promise.resolve();
  });

  // 승인 전에는 역할 선택 문구가 없다.
  expect(hasText(renderer, '가족의 역할을 정해주세요')).toBe(false);

  await press(renderer, '이종철 승인');
  expect(hasText(renderer, '가족의 역할을 정해주세요')).toBe(true);

  await press(renderer, '보호자로 지정');

  // 역할 지정과 함께 카드가 사라지고 모달이 닫힌다.
  expect(hasText(renderer, '이종철')).toBe(false);
  expect(hasText(renderer, '가족의 역할을 정해주세요')).toBe(false);
  expect(decisions).toEqual([
    {joinRequestId: 'jr-jong', decision: 'APPROVE', assignedRole: 'guardian'},
  ]);
});

test('요청이 없으면 안내 문구를 보여준다', async () => {
  const renderer = await renderScreen([]);

  expect(hasText(renderer, '승인 요청 0건')).toBe(true);
  expect(hasText(renderer, '대기 중인 가입 요청이 없어요.')).toBe(true);
});
