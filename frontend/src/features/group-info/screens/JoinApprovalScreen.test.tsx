import React from 'react';
import {Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {ApiError} from '../../../shared/api';
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

test('각 가입 요청의 승인 버튼을 왼쪽, 거절 버튼을 오른쪽에 표시한다', async () => {
  const renderer = await renderScreen([REQUESTS[0]]);
  const actionLabels = renderer.root
    .findAll(node => node.props.accessibilityRole === 'button')
    .map(node => node.props.accessibilityLabel)
    .filter(label => label === '손수호 승인' || label === '손수호 거절')
    .filter((label, index, labels) => index === 0 || label !== labels[index - 1]);

  expect(actionLabels).toEqual(['손수호 승인', '손수호 거절']);
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

test('일반 처리 실패는 안내 팝업을 보여주고 확인 후 카드를 유지한다', async () => {
  const renderer = await renderScreen(REQUESTS, async () => {
    throw new Error('network');
  });

  await press(renderer, '손수호 거절');

  expect(hasText(renderer, '손수호')).toBe(true);
  expect(hasText(renderer, '가입 요청을 처리하지 못했습니다.')).toBe(true);
  expect(hasText(renderer, '잠시 후 다시 시도해 주세요.')).toBe(false);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: '가입 요청 처리 실패 안내',
    }).length,
  ).toBeGreaterThan(0);

  await press(renderer, '가입 요청 처리 실패 확인');

  expect(hasText(renderer, '가입 요청을 처리하지 못했습니다.')).toBe(false);
  expect(hasText(renderer, '손수호')).toBe(true);
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

test('피보호자 중복 409는 역할 팝업을 닫고 전용 안내 팝업을 보여준다', async () => {
  const renderer = await renderScreen(REQUESTS, async () => {
    throw new ApiError({
      code: 'CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP',
      kind: 'server',
      message: 'conflict',
      status: 409,
    });
  });

  await press(renderer, '이종철 승인');
  await press(renderer, '피보호자로 지정');

  // 실패해도 "참여했습니다" 역할 팝업이 남지 않는다.
  expect(hasText(renderer, '가족의 역할을 정해주세요')).toBe(false);
  expect(hasText(renderer, '이종철')).toBe(true);
  expect(hasText(renderer, '피보호자로 승인할 수 없어요')).toBe(true);
  expect(
    hasText(
      renderer,
      '신청자가 이미 다른 그룹의 피보호자예요. 보호자 역할로만 승인할 수 있어요.',
    ),
  ).toBe(true);

  await press(renderer, '피보호자 승인 제한 확인');

  expect(hasText(renderer, '피보호자로 승인할 수 없어요')).toBe(false);
  expect(hasText(renderer, '이종철')).toBe(true);
});

test('이미 처리된 요청 409는 문구를 보여주고 카드를 정리한다', async () => {
  const renderer = await renderScreen(REQUESTS, async () => {
    throw new ApiError({
      code: 'JOIN_REQUEST_ALREADY_PROCESSED',
      kind: 'server',
      message: 'conflict',
      status: 409,
    });
  });

  await press(renderer, '손수호 거절');

  expect(hasText(renderer, '손수호')).toBe(false);
  expect(hasText(renderer, '이미 처리된 가입 요청이에요.')).toBe(true);
});

test('요청이 없으면 안내 문구를 보여준다', async () => {
  const renderer = await renderScreen([]);

  expect(hasText(renderer, '승인 요청 0건')).toBe(true);
  expect(hasText(renderer, '대기 중인 가입 요청이 없어요.')).toBe(true);
});
