import React from 'react';
import TestRenderer from 'react-test-renderer';

import {ReactionPopover} from './ReactionPopover';

test('원래 + 버튼 위치를 다시 누르면 열린 반응 팝오버를 닫는다', async () => {
  const onClose = jest.fn();
  let renderer: TestRenderer.ReactTestRenderer;

  await TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <ReactionPopover
        anchor={{height: 44, width: 44, x: 100, y: 200}}
        onClose={onClose}
        onSelect={jest.fn()}
        selectedReactionId={null}
        visible
      />,
    );
  });

  const anchorDismissButton = renderer!.root
    .findAllByProps({
      accessibilityLabel: '반응 추가 버튼 다시 눌러 닫기',
    })
    .find(node => typeof node.props.onPress === 'function');
  expect(anchorDismissButton).toBeTruthy();

  await TestRenderer.act(() => {
    anchorDismissButton!.props.onPress();
  });

  expect(onClose).toHaveBeenCalledTimes(1);

  await TestRenderer.act(() => {
    renderer!.unmount();
  });
});
