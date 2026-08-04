import {act, create, type ReactTestRenderer} from 'react-test-renderer';

import {ReactionBar} from './ReactionBar';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

test('선택한 반응 칩을 다시 누르면 같은 반응 ID로 취소 요청을 전달한다', () => {
  const onSelectReaction = jest.fn();
  let renderer: ReactTestRenderer;

  act(() => {
    renderer = create(
      <ReactionBar
        canReact
        isPickerOpen={false}
        onSelectReaction={onSelectReaction}
        onTogglePicker={jest.fn()}
        reactions={[
          {count: 1, emoji: '❤️', id: 'HEART', label: '사랑해요'},
        ]}
        selectedReactionId="HEART"
      />,
    );
  });

  act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '사랑해요 반응 1개, 내가 선택함'})
      .props.onPress();
  });

  expect(onSelectReaction).toHaveBeenCalledWith('HEART');

  act(() => renderer!.unmount());
});
