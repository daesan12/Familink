import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {StyleSheet, Text as ReactNativeText} from 'react-native';

import {FONT_FAMILIES} from '../../design/tokens';
import {AppText} from './AppText';

describe('AppText', () => {
  it('Wanted Sans를 기본 글꼴로 적용한다', async () => {
    const rendererHolder: {current?: ReactTestRenderer} = {};

    await act(async () => {
      rendererHolder.current = create(
        <AppText style={{fontWeight: '700'}}>가족 링크</AppText>,
      );
    });

    const renderer = rendererHolder.current;
    if (renderer === undefined) {
      throw new Error('AppText renderer was not created');
    }

    const style = StyleSheet.flatten(
      renderer.root.findByType(ReactNativeText).props.style,
    );
    expect(style).toMatchObject({
      fontFamily: FONT_FAMILIES.bold,
      fontWeight: '700',
    });
  });

  it.each([
    ['400', FONT_FAMILIES.regular],
    ['500', FONT_FAMILIES.medium],
    ['600', FONT_FAMILIES.semiBold],
    ['700', FONT_FAMILIES.bold],
    ['800', FONT_FAMILIES.extraBold],
  ] as const)('%s 굵기의 정적 폰트 파일을 선택한다', async (fontWeight, fontFamily) => {
    const rendererHolder: {current?: ReactTestRenderer} = {};

    await act(async () => {
      rendererHolder.current = create(
        <AppText style={{fontWeight}}>{fontWeight}</AppText>,
      );
    });

    const renderer = rendererHolder.current;
    if (renderer === undefined) {
      throw new Error('AppText renderer was not created');
    }

    const style = StyleSheet.flatten(
      renderer.root.findByType(ReactNativeText).props.style,
    );
    expect(style.fontFamily).toBe(fontFamily);
  });
});
