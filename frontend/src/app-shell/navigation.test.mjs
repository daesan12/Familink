import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getTabsForRole,
  isRouteAllowed,
  resolveAllowedRoute,
  resolveCurrentGroup,
} from './navigation.ts';

test('보호자는 리포트 탭만 역할 전용 탭으로 본다', () => {
  const tabs = getTabsForRole('guardian');
  const routes = tabs.map((tab) => tab.route);

  assert.deepEqual(routes, [
    'feed',
    'calendar',
    'report',
    'groupInfo',
    'profile',
  ]);
  assert.equal(tabs[2]?.icon, 'file-chart-column');
  assert.equal(isRouteAllowed('guardian', 'aiCall'), false);
});

test('피보호자는 AI 전화 탭만 역할 전용 탭으로 본다', () => {
  const tabs = getTabsForRole('careReceiver');
  const routes = tabs.map((tab) => tab.route);

  assert.deepEqual(routes, [
    'feed',
    'calendar',
    'aiCall',
    'groupInfo',
    'profile',
  ]);
  assert.equal(tabs[2]?.icon, 'phone-call');
  assert.equal(isRouteAllowed('careReceiver', 'report'), false);
});

test('모든 하단 탭은 지정한 Lucide line 아이콘을 사용한다', () => {
  const icons = getTabsForRole('guardian').map((tab) => tab.icon);

  assert.deepEqual(icons, [
    'house',
    'calendar',
    'file-chart-column',
    'users-round',
    'circle-user-round',
  ]);
});

test('역할에 허용되지 않은 화면은 피드로 안전하게 이동한다', () => {
  assert.equal(resolveAllowedRoute('guardian', 'aiCall'), 'feed');
  assert.equal(resolveAllowedRoute('careReceiver', 'report'), 'feed');
});

test('저장된 그룹이 있으면 복원하고 없으면 마지막 이용 가능 그룹을 쓴다', () => {
  const groups = [
    {id: 'group-a', name: '행복한 가족', role: 'guardian'},
    {id: 'group-b', name: '든든한 가족', role: 'careReceiver'},
  ];

  assert.equal(resolveCurrentGroup(groups, 'group-a')?.id, 'group-a');
  assert.equal(resolveCurrentGroup(groups, 'missing')?.id, 'group-b');
  assert.equal(resolveCurrentGroup([], 'group-a'), null);
});

test('그룹 전환 뒤 모든 화면이 선택한 그룹을 다시 해석할 수 있다', () => {
  const groups = [
    {id: 'group-a', name: '행복한 가족', role: 'guardian'},
    {id: 'group-b', name: '든든한 가족', role: 'careReceiver'},
  ];

  const before = resolveCurrentGroup(groups, 'group-a');
  const after = resolveCurrentGroup(groups, 'group-b');

  assert.equal(before?.id, 'group-a');
  assert.equal(after?.id, 'group-b');
  assert.notEqual(before?.id, after?.id);
  assert.equal(before?.role, 'guardian');
  assert.equal(after?.role, 'careReceiver');
  assert.equal(resolveAllowedRoute(after.role, 'report'), 'feed');
});

test('공유 하위 화면은 역할과 무관하게 허용된다', () => {
  // isRouteAllowed의 하위 화면 목록을 빠뜨리면 resolveAllowedRoute가 조용히
  // 'feed'로 폴백해 화면이 열리지 않는다. Record 게이트가 컴파일로도 막지만
  // 런타임 계약을 함께 고정한다.
  for (const route of ['archive', 'joinApproval', 'notifications']) {
    assert.equal(isRouteAllowed('guardian', route), true);
    assert.equal(isRouteAllowed('careReceiver', route), true);
    assert.equal(resolveAllowedRoute('guardian', route), route);
  }
});
