import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useState} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import {COLORS, RADII} from '../../../design/tokens';
import type {FeedImage} from '../types';

interface PostImageCarouselProps {
  images: readonly FeedImage[];
  variant?: 'feed' | 'detail';
}

export function PostImageCarousel({
  images,
  variant = 'feed',
}: PostImageCarouselProps) {
  const {width: windowWidth} = useWindowDimensions();
  const horizontalInset = variant === 'detail' ? 32 : 40;
  const width = Math.min(Math.max(windowWidth - horizontalInset, 1), 520);
  const height = Math.round(width * 0.632);
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(nextIndex, images.length - 1)));
  };

  return (
    <View
      accessibilityLabel={`게시글 이미지 ${images.length}장`}
      style={[styles.carousel, {height, width}]}
    >
      <FlatList
        bounces={false}
        data={images}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          index,
          length: width,
          offset: width * index,
        })}
        horizontal
        keyExtractor={image => image.id}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        pagingEnabled
        renderItem={({item}) => (
          <FeedImageFrame height={height} image={item} width={width} />
        )}
        showsHorizontalScrollIndicator={false}
        snapToInterval={width}
      />

      {images.length > 1 ? (
        <View
          accessibilityLabel={`${images.length}장 중 ${activeIndex + 1}번째 이미지`}
          style={styles.indicator}
        >
          <Text style={styles.indicatorText}>
            {activeIndex + 1}/{images.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

interface FeedImageFrameProps {
  height: number;
  image: FeedImage;
  width: number;
}

function FeedImageFrame({height, image, width}: FeedImageFrameProps) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  );
  const [retryCount, setRetryCount] = useState(0);

  return (
    <View style={[styles.imageFrame, {height, width}]}>
      {loadState === 'loading' ? (
        <View accessibilityLabel="이미지 불러오는 중" style={styles.placeholder}>
          <ActivityIndicator color={COLORS.purple} />
        </View>
      ) : null}

      {loadState === 'error' ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    alignSelf: 'center',
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    overflow: 'hidden',
    position: 'relative',
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
  },
  indicator: {
    backgroundColor: COLORS.imageOverlay,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    bottom: 12,
    minWidth: 42,
    paddingHorizontal: 10,
    paddingVertical: 5,
    position: 'absolute',
    right: 12,
  },
  indicatorText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 1,
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
});
