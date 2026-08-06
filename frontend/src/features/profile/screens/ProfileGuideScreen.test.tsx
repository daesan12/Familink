import React from 'react';
import {StyleSheet} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {BackButton} from '../../../shared/components/BackButton';
import {ProfileGuideScreen} from './ProfileGuideScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

test('뒤로가기 버튼을 다른 하위 화면과 같은 왼쪽 위치에 배치한다', () => {
  let renderer: TestRenderer.ReactTestRenderer;

  TestRenderer.act(() => {
    renderer = TestRenderer.create(<ProfileGuideScreen onBack={jest.fn()} />);
  });

  const backButton = renderer!.root.findByType(BackButton);

  const positionStyle = StyleSheet.flatten(backButton.props.style);

  expect(positionStyle).toMatchObject({
    left: 20,
    position: 'absolute',
  });
  expect(positionStyle).not.toHaveProperty('backgroundColor');
  expect(positionStyle).not.toHaveProperty('height');
  expect(positionStyle).not.toHaveProperty('width');

  TestRenderer.act(() => {
    renderer!.unmount();
  });
});
