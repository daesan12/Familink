import {act, create, type ReactTestRenderer} from 'react-test-renderer';

import {PostImageCarousel} from './PostImageCarousel';

jest.mock('@react-native-vector-icons/material-design-icons', () => {
  const React = require('react');
  const {Text} = require('react-native');

  return function MockIcon({name}: {name: string}) {
    return React.createElement(Text, null, name);
  };
});

jest.mock('react-native-video', () => {
  const React = require('react');
  const {View} = require('react-native');

  return function MockVideo(props: object) {
    return React.createElement(View, props);
  };
});

describe('PostImageCarousel', () => {
  it('영상 재생 버튼을 누르면 원본 fileUrl을 플레이어에 전달한다', () => {
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(
        <PostImageCarousel
          images={[
            {
              fileUrl: 'https://cdn.example.com/video.mp4?signature=valid',
              hasPoster: true,
              id: 'video-1',
              mediaType: 'VIDEO',
              source: {uri: 'https://cdn.example.com/thumbnail.jpg'},
            },
          ]}
        />,
      );
    });

    expect(() => renderer!.root.findByProps({testID: 'post-video-player'})).toThrow();

    act(() => {
      renderer!.root.findByProps({accessibilityLabel: '동영상 재생'}).props.onPress();
    });

    expect(
      renderer!.root.findByProps({testID: 'post-video-player'}).props.source,
    ).toEqual({uri: 'https://cdn.example.com/video.mp4?signature=valid'});

    act(() => renderer!.unmount());
  });

  it('stops video playback when its feed item becomes invisible', () => {
    const image = {
      fileUrl: 'https://cdn.example.com/video.mp4?signature=valid',
      hasPoster: true,
      id: 'video-1',
      mediaType: 'VIDEO' as const,
      source: {uri: 'https://cdn.example.com/thumbnail.jpg'},
    };
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(<PostImageCarousel images={[image]} isVisible />);
    });
    act(() => {
      renderer!.root.findByProps({accessibilityLabel: '동영상 재생'}).props.onPress();
    });
    expect(renderer!.root.findByProps({testID: 'post-video-player'})).toBeTruthy();

    act(() => {
      renderer!.update(
        <PostImageCarousel images={[image]} isVisible={false} />,
      );
    });

    expect(() =>
      renderer!.root.findByProps({testID: 'post-video-player'}),
    ).toThrow();

    act(() => renderer!.unmount());
  });
});
