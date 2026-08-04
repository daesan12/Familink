import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useState} from 'react';
import {
  FlatList,
  Modal,
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
import {CachedRemoteImage} from '../../../shared/media/CachedRemoteImage';

export interface ViewerImage {
  accessibilityLabel?: string;
  id: string;
  source: ImageSourcePropType;
}

interface PostImageViewerProps {
  images: readonly ViewerImage[];
  initialIndex: number;
  onClose: () => void;
  visible: boolean;
}

export function PostImageViewer({
  images,
  initialIndex,
  onClose,
  visible,
}: PostImageViewerProps) {
  const {height, width} = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (visible) {
      setActiveIndex(initialIndex);
    }
  }, [initialIndex, visible]);

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(nextIndex, images.length - 1)));
  };

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={onClose}
      statusBarTranslucent
      transparent={false}
      visible={visible}
    >
      <View style={styles.container}>
        <FlatList
          data={images}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            index,
            length: width,
            offset: width * index,
          })}
          horizontal
          initialScrollIndex={Math.min(
            initialIndex,
            Math.max(images.length - 1, 0),
          )}
          key={`${initialIndex}-${visible}`}
          keyExtractor={image => image.id}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          pagingEnabled
          renderItem={({item}) => (
            <View style={{height, width}}>
              <CachedRemoteImage
                accessibilityLabel={
                  item.accessibilityLabel ?? '게시글 사진 전체보기'
                }
                accessibilityRole="image"
                resizeMode="contain"
                source={item.source}
                style={{height, width}}
              />
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />

        <Pressable
          accessibilityLabel="사진 전체보기 닫기"
          accessibilityRole="button"
          onPress={onClose}
          style={styles.closeButton}
        >
          <MaterialDesignIcons
            color={COLORS.background}
            name="close"
            size={26}
          />
        </Pressable>

        {images.length > 1 ? (
          <View
            accessibilityLabel={`${images.length}장 중 ${activeIndex + 1}번째 사진`}
            style={styles.counter}
          >
            <Text style={styles.counterText}>
              {activeIndex + 1} / {images.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    alignItems: 'center',
    backgroundColor: COLORS.imageOverlay,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    top: 40,
    width: 44,
  },
  container: {
    backgroundColor: COLORS.textStrong,
    flex: 1,
  },
  counter: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: COLORS.imageOverlay,
    borderCurve: 'continuous',
    borderRadius: RADII.pill,
    bottom: 28,
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
  },
  counterText: {
    color: COLORS.background,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
});
