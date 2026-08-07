import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import Video, {type VideoRef} from 'react-native-video';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {AppText} from '../../../shared/components/AppText';

import {COLORS, RADII} from '../../../design/tokens';
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';
import {RetryButton} from '../../../shared/components/RetryButton';
import {PostImageViewer} from './PostImageViewer';

const IMAGE_GAP = 10;
// 다음 사진이 더 있다는 것을 알리려고 사진을 이만큼 좁게 그린다.
// 목록 끝에 여백을 더하지 않으므로 마지막 사진에서는 이전 사진이 왼쪽에 걸친다.
const NEXT_IMAGE_PEEK = 28;

export interface CarouselImage {
  accessibilityLabel?: string;
  fileUrl?: string;
  hasPoster?: boolean;
  id: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  source: ImageSourcePropType;
  viewerSource?: ImageSourcePropType;
}

interface PostImageCarouselProps {
  enableFullscreen?: boolean;
  images: readonly CarouselImage[];
  isVisible?: boolean;
  onImagePress?: () => void;
  onRemove?: (imageId: string) => void;
}

export function PostImageCarousel({
  enableFullscreen = false,
  images,
  isVisible = true,
  onImagePress,
  onRemove,
}: PostImageCarouselProps) {
  const {width: windowWidth} = useWindowDimensions();
  const containerWidth = Math.min(
    Math.max(windowWidth - 40, 1),
    520,
  );
  const hasMultipleImages = images.length > 1;
  const usesPeekLayout = hasMultipleImages;
  const imageWidth = usesPeekLayout
    ? containerWidth - NEXT_IMAGE_PEEK
    : containerWidth;
  const imageHeight = Math.round(containerWidth * 0.632);
  const snapInterval = imageWidth + (usesPeekLayout ? IMAGE_GAP : 0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(images.length - 1, 0)));
  }, [images.length]);

  if (images.length === 0) {
    return null;
  }

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / snapInterval,
    );
    setActiveIndex(Math.max(0, Math.min(nextIndex, images.length - 1)));
  };

  return (
    <View
      accessibilityLabel={`게시글 이미지 ${images.length}장`}
      style={[styles.root, {width: containerWidth}]}
    >
      <FlatList
        bounces={false}
        data={images}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          index,
          length: snapInterval,
          offset: snapInterval * index,
        })}
        horizontal
        ItemSeparatorComponent={
          usesPeekLayout ? CarouselSeparator : undefined
        }
        keyExtractor={image => image.id}
        nestedScrollEnabled
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({index, item}) => (
          <FeedImageFrame
            height={imageHeight}
            image={item}
            isVisible={isVisible}
            onPress={
              enableFullscreen && item.mediaType !== 'VIDEO'
                ? () => setViewerIndex(index)
                : onImagePress
            }
            onRemove={onRemove}
            opensFullscreen={enableFullscreen && item.mediaType !== 'VIDEO'}
            width={imageWidth}
          />
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
      />

      {hasMultipleImages ? (
        <View
          accessibilityLabel={`${images.length}장 중 ${activeIndex + 1}번째 이미지`}
          style={styles.dots}
        >
          {images.map((image, index) => (
            <View
              key={image.id}
              style={[styles.dot, index === activeIndex && styles.activeDot]}
            />
          ))}
        </View>
      ) : null}

      <PostImageViewer
        images={images.map(image => ({
          accessibilityLabel: image.accessibilityLabel,
          id: image.id,
          source: image.viewerSource ?? image.source,
        }))}
        initialIndex={viewerIndex ?? 0}
        onClose={() => setViewerIndex(null)}
        visible={viewerIndex !== null}
      />
    </View>
  );
}

function CarouselSeparator() {
  return <View style={styles.separator} />;
}

interface FeedImageFrameProps {
  height: number;
  image: CarouselImage;
  isVisible: boolean;
  onPress?: () => void;
  onRemove?: (imageId: string) => void;
  opensFullscreen: boolean;
  width: number;
}

function FeedImageFrame({
  height,
  image,
  isVisible,
  onPress,
  onRemove,
  opensFullscreen,
  width,
}: FeedImageFrameProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoPlayGeneration, setVideoPlayGeneration] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<VideoRef>(null);
  const isVideoFullscreenRef = useRef(false);
  const isVideo = image.mediaType === 'VIDEO';
  const hasPoster = !isVideo || image.hasPoster !== false;
  const hasPlayableVideo =
    isVideo &&
    image.fileUrl !== undefined &&
    image.fileUrl.trim().length > 0;
  const canPlayVideo = isVisible && hasPlayableVideo;
  const keepsFullscreenVideoMounted =
    isPlaying && !isVisible && hasPlayableVideo && isVideoFullscreenRef.current;

  useEffect(() => {
    if (isVideoFullscreenRef.current) {
      videoRef.current?.dismissFullscreenPlayer();
      isVideoFullscreenRef.current = false;
    }
    setIsPlaying(false);
    setVideoEnded(false);
    setVideoError(false);
  }, [image.fileUrl, image.id]);

  useEffect(() => {
    if (!isVisible) {
      if (isVideoFullscreenRef.current) {
        videoRef.current?.dismissFullscreenPlayer();
        isVideoFullscreenRef.current = false;
      }
      setIsPlaying(false);
      setVideoEnded(false);
    }
  }, [isVisible]);

  const handleVideoPlayPress = () => {
    if (!canPlayVideo) {
      onPress?.();
      return;
    }

    setVideoError(false);
    setVideoEnded(false);
    setVideoPlayGeneration(generation => generation + 1);
    setIsPlaying(true);
  };

  if (isPlaying && (canPlayVideo || keepsFullscreenVideoMounted)) {
    return (
      <View style={[styles.imageFrame, {height, width}]}>
        <Video
          controls={!videoEnded}
          key={`${image.id}-${videoPlayGeneration}`}
          onEnd={() => {
            // Native fullscreen is rendered in a separate player window, so
            // the React replay overlay cannot appear inside it. Close it at
            // the end and reveal the replay button in the carousel frame.
            if (isVideoFullscreenRef.current) {
              videoRef.current?.dismissFullscreenPlayer();
              isVideoFullscreenRef.current = false;
            }
            setVideoEnded(true);
          }}
          onError={() => {
            if (isVideoFullscreenRef.current) {
              videoRef.current?.dismissFullscreenPlayer();
              isVideoFullscreenRef.current = false;
            }
            setIsPlaying(false);
            setVideoEnded(false);
            setVideoError(true);
          }}
          onFullscreenPlayerDidDismiss={() => {
            isVideoFullscreenRef.current = false;
          }}
          onFullscreenPlayerDidPresent={() => {
            isVideoFullscreenRef.current = true;
          }}
          onFullscreenPlayerWillDismiss={() => {
            isVideoFullscreenRef.current = false;
          }}
          onFullscreenPlayerWillPresent={() => {
            isVideoFullscreenRef.current = true;
          }}
          paused={!isVisible || videoEnded}
          ref={videoRef}
          resizeMode="contain"
          source={{uri: image.fileUrl}}
          style={[styles.videoPlayer, {height, width}]}
          testID="post-video-player"
        />
        {videoEnded ? (
          <View style={styles.videoEndedOverlay}>
            <Pressable
              accessibilityLabel="동영상 다시보기"
              accessibilityRole="button"
              onPress={handleVideoPlayPress}
              style={({pressed}) => [
                styles.replayButton,
                pressed && styles.replayButtonPressed,
              ]}
              testID="post-video-replay-button"
            >
              <MaterialDesignIcons
                color={COLORS.background}
                name="replay"
                size={22}
              />
              <AppText style={styles.replayButtonText}>다시보기</AppText>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  const handleMediaPress = () => {
    handleVideoPlayPress();
  };

  return (
    <View style={[styles.imageFrame, {height, width}]}>
      {hasPoster && loadState === 'loading' ? (
        <View accessibilityLabel="이미지 불러오는 중" style={styles.placeholder}>
          <ActivityIndicator color={COLORS.purple} />
        </View>
      ) : null}

      {hasPoster && loadState === 'error' ? (
        <View accessibilityLiveRegion="polite" style={styles.errorState}>
          <AppText style={styles.errorText}>이미지를 불러오지 못했어요</AppText>
          <RetryButton
            accessibilityLabel="이미지 다시 불러오기"
            onPress={() => {
              setLoadState('loading');
              setRetryCount(count => count + 1);
            }}
          />
        </View>
      ) : null}

      <Pressable
        accessibilityHint={
          canPlayVideo
            ? '현재 화면에서 동영상을 재생합니다'
            : opensFullscreen
              ? '전체 화면에서 사진을 봅니다'
            : onPress
              ? '게시글 상세 화면으로 이동합니다'
              : undefined
        }
        accessibilityLabel={
          canPlayVideo
            ? '동영상 재생'
            : opensFullscreen
              ? '게시글 사진 전체보기'
              : undefined
        }
        accessibilityRole={canPlayVideo || onPress ? 'button' : undefined}
        disabled={!canPlayVideo && !onPress}
        onPress={handleMediaPress}
        testID={canPlayVideo ? 'post-video-poster' : undefined}
      >
        {hasPoster ? (
          <CachedRemoteImage
            accessibilityLabel={image.accessibilityLabel}
            accessibilityRole="image"
            key={`${image.id}-${retryCount}`}
            onError={() => setLoadState('error')}
            onLoad={() => setLoadState('loaded')}
            onLoadStart={() => setLoadState('loading')}
            resizeMode="cover"
            source={image.source}
            style={[
              styles.image,
              loadState !== 'loaded' && styles.hiddenImage,
              {height, width},
            ]}
          />
        ) : null}
        {isVideo ? (
          <View
            accessibilityLabel="동영상 미리보기"
            pointerEvents="none"
            style={[
              hasPoster ? styles.videoBadge : styles.videoFallback,
              {height, width},
            ]}
          >
            <MaterialDesignIcons
              color={COLORS.background}
              name="play-circle-outline"
              size={48}
            />
          </View>
        ) : null}
      </Pressable>

      {videoError ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={styles.videoError}
        >
          <AppText style={styles.videoErrorText}>
            영상을 재생할 수 없어요. 다시 시도해 주세요.
          </AppText>
        </View>
      ) : null}

      {onRemove ? (
        <Pressable
          accessibilityLabel="선택한 사진 제거"
          accessibilityRole="button"
          onPress={() => onRemove(image.id)}
          style={styles.removeButton}
        >
          <MaterialDesignIcons color={COLORS.background} name="close" size={18} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  activeDot: {
    backgroundColor: COLORS.purple,
  },
  dot: {
    backgroundColor: COLORS.inactive,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 6,
    width: 6,
  },
  dots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 24,
    paddingTop: 10,
  },
  errorState: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    gap: 12,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 2,
  },
  errorText: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  hiddenImage: {
    opacity: 0,
  },
  image: {
    backgroundColor: COLORS.surface,
  },
  imageFrame: {
    backgroundColor: COLORS.surface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 1,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: COLORS.imageOverlay,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 10,
    top: 10,
    width: 36,
    zIndex: 3,
  },
  root: {
    alignSelf: 'center',
    overflow: 'hidden',
  },
  separator: {
    width: IMAGE_GAP,
  },
  videoBadge: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  videoFallback: {
    alignItems: 'center',
    backgroundColor: COLORS.imageOverlay,
    justifyContent: 'center',
  },
  videoError: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    paddingHorizontal: 24,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  videoErrorText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  videoEndedOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.46)',
    bottom: 0,
    elevation: 2,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  videoPlayer: {
    backgroundColor: COLORS.textStrong,
  },
  replayButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 28, 0.86)',
    borderColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: RADII.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  replayButtonPressed: {
    opacity: 0.76,
    transform: [{scale: 0.96}],
  },
  replayButtonText: {
    color: COLORS.background,
    fontSize: 15,
    fontWeight: '700',
  },
});
