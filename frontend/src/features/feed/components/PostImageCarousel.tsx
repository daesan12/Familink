import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useState} from 'react';
import Video from 'react-native-video';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';

const IMAGE_GAP = 10;
const NEXT_IMAGE_PEEK = 28;

export interface CarouselImage {
  accessibilityLabel?: string;
  fileUrl?: string;
  hasPoster?: boolean;
  id: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  source: ImageSourcePropType;
}

interface PostImageCarouselProps {
  images: readonly CarouselImage[];
  isVisible?: boolean;
  onImagePress?: () => void;
  onRemove?: (imageId: string) => void;
}

export function PostImageCarousel({
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
        contentContainerStyle={
          usesPeekLayout ? styles.multipleContent : undefined
        }
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
        renderItem={({item}) => (
          <FeedImageFrame
            height={imageHeight}
            image={item}
            isVisible={isVisible}
            onPress={onImagePress}
            onRemove={onRemove}
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
  width: number;
}

function FeedImageFrame({
  height,
  image,
  isVisible,
  onPress,
  onRemove,
  width,
}: FeedImageFrameProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [retryCount, setRetryCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const isVideo = image.mediaType === 'VIDEO';
  const hasPoster = !isVideo || image.hasPoster !== false;
  const canPlayVideo =
    isVisible &&
    isVideo &&
    image.fileUrl !== undefined &&
    image.fileUrl.trim().length > 0;

  useEffect(() => {
    setIsPlaying(false);
    setVideoError(false);
  }, [image.fileUrl, image.id]);

  useEffect(() => {
    if (!isVisible) {
      setIsPlaying(false);
    }
  }, [isVisible]);

  if (isPlaying && canPlayVideo) {
    return (
      <View style={[styles.imageFrame, {height, width}]}>
        <Video
          controls
          onEnd={() => setIsPlaying(false)}
          onError={() => {
            setIsPlaying(false);
            setVideoError(true);
          }}
          resizeMode="contain"
          source={{uri: image.fileUrl}}
          style={[styles.videoPlayer, {height, width}]}
          testID="post-video-player"
        />
      </View>
    );
  }

  const handleMediaPress = () => {
    if (canPlayVideo) {
      setVideoError(false);
      setIsPlaying(true);
      return;
    }

    onPress?.();
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
          <Text style={styles.errorText}>이미지를 불러오지 못했어요</Text>
          <Pressable
            accessibilityLabel="이미지 다시 불러오기"
            accessibilityRole="button"
            onPress={() => {
              setLoadState('loading');
              setRetryCount(count => count + 1);
            }}
            style={styles.retryButton}
          >
            <MaterialDesignIcons
              color={COLORS.text}
              name="refresh"
              size={16}
            />
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        accessibilityHint={
          canPlayVideo
            ? '현재 화면에서 동영상을 재생합니다'
            : onPress
              ? '게시글 상세 화면으로 이동합니다'
              : undefined
        }
        accessibilityLabel={canPlayVideo ? '동영상 재생' : undefined}
        accessibilityRole={canPlayVideo || onPress ? 'button' : undefined}
        disabled={!canPlayVideo && !onPress}
        onPress={handleMediaPress}
      >
        {hasPoster ? (
          <Image
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
          <Text style={styles.videoErrorText}>
            영상을 재생할 수 없어요. 다시 시도해 주세요.
          </Text>
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
  multipleContent: {
    paddingRight: NEXT_IMAGE_PEEK,
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
  retryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderColor: COLORS.divider,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
  },
  retryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
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
  videoPlayer: {
    backgroundColor: COLORS.textStrong,
  },
});
