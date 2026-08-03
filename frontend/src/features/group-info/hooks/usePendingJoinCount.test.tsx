import React from 'react';
import TestRenderer from 'react-test-renderer';

import type {JoinRequestsLoader} from '../api/groupMembershipApi';
import type {JoinRequest, PendingJoinCountState} from '../types';
import {usePendingJoinCount} from './usePendingJoinCount';

const PENDING: JoinRequest = {
  applicantName: '손수호',
  applicantUserId: 'applicant-1',
  assignedRole: null,
  createdAt: '2026-07-30T09:12:00Z',
  joinRequestId: 'jr-1',
  processedAt: null,
  profileImageUrl: null,
  status: 'PENDING_ADMIN',
};

const ANOTHER_PENDING: JoinRequest = {
  ...PENDING,
  applicantName: '이종철',
  applicantUserId: 'applicant-2',
  joinRequestId: 'jr-2',
};

// 서버가 처리된 요청을 함께 내려주는 경우. 대기 건수에서 빠져야 한다.
const APPROVED: JoinRequest = {
  ...PENDING,
  applicantName: '한복녀',
  applicantUserId: 'applicant-3',
  assignedRole: 'guardian',
  joinRequestId: 'jr-3',
  processedAt: '2026-07-31T02:00:00Z',
  status: 'APPROVED',
};

function State(_props: {state: PendingJoinCountState}) {
  return null;
}

function Harness({
  isManager = true,
  loader,
  reloadKey = 0,
}: {
  isManager?: boolean;
  loader?: JoinRequestsLoader;
  reloadKey?: number;
}) {
  const state = usePendingJoinCount('group-1', loader, isManager, reloadKey);

  return React.createElement(State, {state});
}

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  while (mountedRenderers.length > 0) {
    const renderer = mountedRenderers.pop();
    TestRenderer.act(() => renderer?.unmount());
  }
});

async function render(props: React.ComponentProps<typeof Harness>) {
  let renderer: TestRenderer.ReactTestRenderer;
  await TestRenderer.act(async () => {
    renderer = TestRenderer.create(<Harness {...props} />);
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function stateOf(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root.findByType(State).props.state;
}

test('관리자는 대기 중 요청만 세어 건수를 얻는다', async () => {
  const loader = jest
    .fn<ReturnType<JoinRequestsLoader>, Parameters<JoinRequestsLoader>>()
    .mockResolvedValue([PENDING, ANOTHER_PENDING, APPROVED]);

  const renderer = await render({loader});

  expect(loader).toHaveBeenCalledWith('group-1');
  expect(stateOf(renderer)).toEqual({count: 2, status: 'success'});
});

test('관리자가 아니면 조회하지 않고 건수를 미확정으로 둔다', async () => {
  const loader = jest
    .fn<ReturnType<JoinRequestsLoader>, Parameters<JoinRequestsLoader>>()
    .mockResolvedValue([PENDING]);

  const renderer = await render({isManager: false, loader});

  expect(loader).not.toHaveBeenCalled();
  expect(stateOf(renderer)).toEqual({status: 'disabled'});
});

test('로더가 없으면 조회하지 않고 건수를 미확정으로 둔다', async () => {
  const renderer = await render({});

  expect(stateOf(renderer)).toEqual({status: 'disabled'});
});

test('조회에 실패하면 오류 상태로 남는다', async () => {
  const loader = jest
    .fn<ReturnType<JoinRequestsLoader>, Parameters<JoinRequestsLoader>>()
    .mockRejectedValue(new Error('403'));

  const renderer = await render({loader});

  expect(stateOf(renderer)).toEqual({status: 'error'});
});

test('reloadKey가 바뀌면 다시 조회해 건수를 갱신한다', async () => {
  const loader = jest
    .fn<ReturnType<JoinRequestsLoader>, Parameters<JoinRequestsLoader>>()
    .mockResolvedValueOnce([PENDING, ANOTHER_PENDING])
    .mockResolvedValueOnce([ANOTHER_PENDING]);

  const renderer = await render({loader});
  expect(stateOf(renderer)).toEqual({count: 2, status: 'success'});

  await TestRenderer.act(async () => {
    renderer.update(<Harness loader={loader} reloadKey={1} />);
  });

  expect(loader).toHaveBeenCalledTimes(2);
  expect(stateOf(renderer)).toEqual({count: 1, status: 'success'});
});
