import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {launchImageLibrary} from 'react-native-image-picker';

import {PostComposerScreen} from './PostComposerScreen';

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');
jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

test('업로드 중에는 본문과 미디어 선택·제거를 잠근다', () => {
  let renderer: ReactTestRenderer;

  act(() => {
    renderer = create(
      <PostComposerScreen
        initialValue={{
          body: '업로드 중인 게시글',
          media: [
            {
              contentType: 'video/mp4',
              durationSeconds: 30,
              fileName: 'video.mp4',
              fileSizeBytes: 1024,
              id: 'video-1',
              kind: 'video',
              source: {uri: 'file:///video.mp4'},
              sourceType: 'local',
            },
          ],
        }}
        mode="create"
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
        uploadState={{progress: 0.3, status: 'uploading'}}
      />,
    );
  });

  expect(renderer!.root.findByProps({accessibilityLabel: '게시글 본문'}).props.editable)
    .toBe(false);
  expect(renderer!.root.findByProps({accessibilityLabel: '사진 선택'}).props.disabled)
    .toBe(true);
  expect(renderer!.root.findByProps({accessibilityLabel: '영상 선택'}).props.disabled)
    .toBe(true);
  expect(
    renderer!.root.findAllByProps({accessibilityLabel: '선택한 영상 제거'}),
  ).toHaveLength(0);
  expect(
    renderer!.root.findByProps({accessibilityLabel: '영상 업로드 중 30%'}),
  ).toBeTruthy();
  expect(
    renderer!.root.findByProps({accessibilityRole: 'progressbar'}).props
      .accessibilityValue,
  ).toEqual({max: 100, min: 0, now: 30});
  expect(launchImageLibrary).not.toHaveBeenCalled();

  act(() => renderer!.unmount());
});

test('텍스트 게시글은 미디어 표현 없이 업로드 상태를 안내한다', () => {
  let renderer: ReactTestRenderer;

  act(() => {
    renderer = create(
      <PostComposerScreen
        initialValue={{body: '텍스트 게시글', media: []}}
        mode="create"
        onCancel={jest.fn()}
        onSubmit={jest.fn()}
        uploadState={{progress: 1, status: 'uploading'}}
      />,
    );
  });

  expect(
    renderer!.root.findByProps({accessibilityLabel: '업로드 중 100%'}),
  ).toBeTruthy();
  expect(
    renderer!.root.findAllByProps({children: '미디어 업로드 중'}),
  ).toHaveLength(0);

  act(() => renderer!.unmount());
});

test('업로드 실패 카드에서 상세 원인과 다시 시도 동작을 제공한다', () => {
  const onRetryUpload = jest.fn();
  let renderer: ReactTestRenderer;

  act(() => {
    renderer = create(
      <PostComposerScreen
        mode="create"
        onCancel={jest.fn()}
        onRetryUpload={onRetryUpload}
        onSubmit={jest.fn()}
        uploadState={{
          message: '사진은 파일당 10MB 이하만 올릴 수 있습니다.',
          status: 'failure',
        }}
      />,
    );
  });

  expect(
    renderer!.root.findByProps({
      children: '사진은 파일당 10MB 이하만 올릴 수 있습니다.',
    }),
  ).toBeTruthy();

  act(() => {
    renderer!.root
      .findByProps({accessibilityLabel: '미디어 업로드 다시 시도'})
      .props.onPress();
  });

  expect(onRetryUpload).toHaveBeenCalledTimes(1);

  act(() => renderer!.unmount());
});
