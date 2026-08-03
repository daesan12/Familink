import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useState} from 'react';
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
import {RetryButton} from '../../../shared/components/RetryButton';

const IMAGE_GAP = 10;
const NEXT_IMAGE_PEEK = 28;

export interface CarouselImage {
  accessibilityLabel?: string;
  hasPoster?: boolean;
  id: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  source: ImageSourcePropType;
}

interface PostImageCarouselProps {
  images: readonly CarouselImage[];
  onImagePress?: () => void;
  onRemove?: (imageId: string) => void;
}

export function PostImageCarousel({
  images,
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
  onPress?: () => void;
  onRemove?: (imageId: string) => void;
  width: number;
}

function FeedImageFrame({
  height,
  image,
  onPress,
  onRemove,
  width,
}: FeedImageFrameProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [retryCount, setRetryCount] = useState(0);
  const isVideo = image.mediaType === 'VIDEO';
  const hasPoster = !isVideo || image.hasPoster !== false;

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
        accessibilityHint={onPress ? '게시글 상세 화면으로 이동합니다' : undefined}
        accessibilityRole={onPress ? 'button' : undefined}
        disabled={!onPress}
        onPress={onPress}
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
});
