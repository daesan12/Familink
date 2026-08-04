import {StyleSheet, Text} from 'react-native';
import TestRenderer from 'react-test-renderer';

import {MyPageProfileCard} from './MyPageProfileCard';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const mountedRenderers: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  TestRenderer.act(() => {
    mountedRenderers.splice(0).forEach(renderer => renderer.unmount());
  });
});

// 이름은 최대 10자다. 가로폭이 넓은 문자로 채운 최악값에서 레이아웃이 유지되는지가 관심사다.
const MAX_LENGTH_NAME = 'WWWWWWWWWW';

function render(name: string) {
  let renderer: TestRenderer.ReactTestRenderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      <MyPageProfileCard
        age={48}
        gender="female"
        name={name}
        onEdit={jest.fn()}
      />,
    );
  });
  mountedRenderers.push(renderer!);
  return renderer!;
}

function findNameText(renderer: TestRenderer.ReactTestRenderer, name: string) {
  return renderer.root
    .findAllByType(Text)
    .find(node => Array.isArray(node.props.children)
      ? node.props.children.includes(name)
      : node.props.children === name);
}

test('이름이 최대 길이여도 더보기 버튼은 남아 있다', () => {
  const renderer = render(MAX_LENGTH_NAME);

  expect(
    renderer.root.findAllByProps({accessibilityLabel: '프로필 편집'}).length,
  ).toBeGreaterThan(0);
});

test('이름은 남은 폭 안에서 줄어들고 두 줄까지 감싼다', () => {
  // 이름과 "님"을 한 Text에 두어야 줄바꿈 시 "님"이 이름 뒤에 붙어 따라간다.
  const renderer = render(MAX_LENGTH_NAME);

  const nameText = findNameText(renderer, MAX_LENGTH_NAME);
  expect(nameText).toBeDefined();
  expect(nameText?.props.numberOfLines).toBe(2);
  expect(StyleSheet.flatten(nameText?.props.style).flexShrink).toBe(1);
});

test('"님" 호칭은 이름과 같은 Text 안에 있다', () => {
  const renderer = render('이종철');

  const nameText = findNameText(renderer, '이종철');
  expect(nameText?.props.children).toEqual(['이종철', ' 님']);
});
