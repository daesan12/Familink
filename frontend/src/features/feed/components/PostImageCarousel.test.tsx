import {act, create, type ReactTestRenderer} from 'react-test-renderer';

import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
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

  it('restarts a video from the beginning after playback ends', () => {
    const image = {
      fileUrl: 'https://cdn.example.com/video.mp4?signature=valid',
      hasPoster: true,
      id: 'video-replay',
      mediaType: 'VIDEO' as const,
      source: {uri: 'https://cdn.example.com/thumbnail.jpg'},
    };
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(<PostImageCarousel images={[image]} />);
    });

    act(() => {
      renderer!.root.findByProps({accessibilityLabel: '동영상 재생'}).props.onPress();
    });
    const firstPlayer = renderer!.root.findByProps({testID: 'post-video-player'});

    act(() => firstPlayer.props.onEnd());
    expect(() => renderer!.root.findByProps({testID: 'post-video-player'})).toThrow();

    act(() => {
      renderer!.root.findByProps({accessibilityLabel: '동영상 재생'}).props.onPress();
    });
    const replayedPlayer = renderer!.root.findByProps({testID: 'post-video-player'});
    expect(replayedPlayer).not.toBe(firstPlayer);

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

  it('사진을 누르면 전체보기 모달을 열고 닫는다', () => {
    let renderer: ReactTestRenderer;

    act(() => {
      renderer = create(
        <PostImageCarousel
          enableFullscreen
          images={[
            {
              fileUrl: 'file:///photo.jpg',
              id: 'image-1',
              mediaType: 'IMAGE',
              source: {uri: 'file:///thumbnail.jpg'},
              viewerSource: {uri: 'file:///photo.jpg'},
            },
          ]}
        />,
      );
    });

    expect(renderer!.root.findByType(CachedRemoteImage).props.source).toEqual({
      uri: 'file:///thumbnail.jpg',
    });

    act(() => {
      renderer!.root
        .findByProps({accessibilityLabel: '게시글 사진 전체보기'})
        .props.onPress();
    });

    expect(
      renderer!.root.findByProps({accessibilityLabel: '사진 전체보기 닫기'}),
    ).toBeTruthy();
    expect(
      renderer!.root
        .findAllByType(CachedRemoteImage)
        .some(image => image.props.source.uri === 'file:///photo.jpg'),
    ).toBe(true);

    act(() => {
      renderer!.root
        .findByProps({accessibilityLabel: '사진 전체보기 닫기'})
        .props.onPress();
    });

    expect(() =>
      renderer!.root.findByProps({accessibilityLabel: '사진 전체보기 닫기'}),
    ).toThrow();

    act(() => renderer!.unmount());
  });
});
