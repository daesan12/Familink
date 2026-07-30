import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  launchImageLibrary,
  type Asset,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

import {COLORS, RADII} from '../../../design/tokens';
import {PostImageCarousel} from '../components/PostImageCarousel';
import {
  MAX_POST_BODY_LENGTH,
  MAX_POST_IMAGES,
  buildPostSubmitPayload,
  canAddMedia,
  hasComposerChanges,
  validatePickedMedia,
  type ComposerMedia,
  type LocalMedia,
  type PostComposerInitialValue,
  type PostSubmitPayload,
  type UploadState,
} from '../composer/postComposerModel';

const EMPTY_INITIAL_VALUE: PostComposerInitialValue = {body: '', media: []};

interface PostComposerScreenProps {
  initialValue?: PostComposerInitialValue;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onRetryUpload?: () => void;
  onSubmit: (payload: PostSubmitPayload) => void;
  uploadState?: UploadState;
}

export function PostComposerScreen({
  initialValue = EMPTY_INITIAL_VALUE,
  mode,
  onCancel,
  onRetryUpload,
  onSubmit,
  uploadState = {status: 'idle'},
}: PostComposerScreenProps) {
  const [body, setBody] = useState(initialValue.body);
  const [media, setMedia] = useState<readonly ComposerMedia[]>(
    initialValue.media,
  );
  const isDirty = hasComposerChanges(initialValue, body, media);
  const canSubmit =
    (body.trim().length > 0 || media.length > 0) &&
    (mode === 'create' || isDirty);
  const imageMedia = useMemo(
    () =>
      media
        .filter(item => item.kind === 'image')
        .map(item => ({
          accessibilityLabel: '게시글 미리보기 사진',
          id: item.id,
          source: item.source,
        })),
    [media],
  );
  const video = media.find(
    (item): item is LocalMedia => item.kind === 'video',
  );

  const requestClose = () => {
    if (!isDirty) {
      onCancel();
      return;
    }

    Alert.alert(
      mode === 'create' ? '작성 내용을 버릴까요?' : '수정 내용을 버릴까요?',
      '지금까지 변경한 내용은 저장되지 않아요.',
      [
        {style: 'cancel', text: '계속 작성'},
        {onPress: onCancel, style: 'destructive', text: '버리기'},
      ],
    );
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        requestClose();
        return true;
      },
    );

    return () => subscription.remove();
  });

  const addPickedAssets = (
    assets: readonly Asset[],
    kind: LocalMedia['kind'],
    shouldReplace: boolean,
  ) => {
    const invalidReasons = new Set<string>();
    const picked = assets
      .filter((asset): asset is Asset & {uri: string} => Boolean(asset.uri))
      .filter(asset => {
        const reason = validatePickedMedia(kind, {
          contentType: asset.type,
          durationSeconds: asset.duration,
          fileSizeBytes: asset.fileSize,
        });
        if (reason) {
          invalidReasons.add(reason);
          return false;
        }
        return true;
      })
      .map<LocalMedia>((asset, index) => ({
        contentType: asset.type,
        durationSeconds: asset.duration,
        fileSizeBytes: asset.fileSize,
        fileName: asset.fileName,
        id: `${kind}-${asset.uri}-${index}`,
        kind,
        source: {uri: asset.uri},
        sourceType: 'local',
      }));

    if (invalidReasons.size > 0) {
      const messages = [
        invalidReasons.has('size')
          ? '사진은 10MB, 영상은 100MB 이하만 선택할 수 있어요.'
          : null,
        invalidReasons.has('duration')
          ? '영상은 최대 60초까지 선택할 수 있어요.'
          : null,
        invalidReasons.has('type') ? '지원하지 않는 파일 형식이에요.' : null,
      ].filter((message): message is string => Boolean(message));
      Alert.alert('미디어 제한', messages.join('\n'));
    }

    if (picked.length === 0) {
      return;
    }

    if (kind === 'video') {
      setMedia(picked.slice(0, 1));
      return;
    }

    setMedia(current => {
      const base = shouldReplace ? [] : current;
      return [...base, ...picked].slice(0, MAX_POST_IMAGES);
    });
  };

  const openPicker = async (
    kind: LocalMedia['kind'],
    shouldReplace: boolean,
  ) => {
    const remaining = shouldReplace
      ? MAX_POST_IMAGES
      : MAX_POST_IMAGES - media.length;
    const options: ImageLibraryOptions = {
      mediaType: kind === 'image' ? 'photo' : 'video',
      selectionLimit: kind === 'image' ? remaining : 1,
    };
    const result = await launchImageLibrary(options);

    if (result.errorCode) {
      Alert.alert(
        '미디어를 선택할 수 없어요',
        result.errorMessage ?? '잠시 후 다시 시도해 주세요.',
      );
      return;
    }

    if (!result.didCancel && result.assets) {
      addPickedAssets(result.assets, kind, shouldReplace);
    }
  };

  const requestMedia = (kind: LocalMedia['kind']) => {
    const availability = canAddMedia(media, kind);

    if (availability === 'image-limit') {
      Alert.alert(
        '사진은 4장까지 선택할 수 있어요',
        '선택한 사진을 제거한 뒤 다시 추가해 주세요.',
      );
      return;
    }

    if (availability === 'confirm-replace') {
      const isReplacingWithVideo = kind === 'video';
      Alert.alert(
        isReplacingWithVideo
          ? '사진을 영상으로 교체할까요?'
          : '영상을 사진으로 교체할까요?',
        '교체하면 현재 선택한 미디어가 제거돼요.',
        [
          {style: 'cancel', text: '취소'},
          {
            onPress: () => {
              void openPicker(kind, true);
            },
            text: '교체',
          },
        ],
      );
      return;
    }

    void openPicker(kind, false);
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    onSubmit(buildPostSubmitPayload(initialValue, body, media));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="게시글 작성 닫기"
          accessibilityRole="button"
          onPress={requestClose}
          style={styles.headerButton}
        >
          <MaterialDesignIcons
            color={COLORS.textStrong}
            name="arrow-left"
            size={24}
          />
        </Pressable>
        <Text style={styles.title}>
          {mode === 'create' ? '새 게시글' : '게시글 수정'}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{disabled: !canSubmit}}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={styles.submitButton}
        >
          <Text
            style={[
              styles.submitText,
              !canSubmit && styles.disabledSubmitText,
            ]}
          >
            {mode === 'create' ? '작성' : '완료'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inputSection}>
          <TextInput
            accessibilityLabel="게시글 본문"
            maxLength={MAX_POST_BODY_LENGTH}
            multiline
            onChangeText={setBody}
            placeholder="우리 가족에게 전하고 싶은 이야기를 적어보세요."
            placeholderTextColor={COLORS.textDisabled}
            style={styles.input}
            textAlignVertical="top"
            value={body}
          />
          <Text style={styles.counter}>
            {body.length}/{MAX_POST_BODY_LENGTH}
          </Text>
        </View>

        <View style={styles.mediaActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => requestMedia('image')}
            style={({pressed}) => [
              styles.mediaButton,
              pressed && styles.pressedButton,
            ]}
          >
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="image-multiple-outline"
              size={24}
            />
            <Text style={styles.mediaButtonText}>사진</Text>
            <Text style={styles.mediaCount}>
              {imageMedia.length}/{MAX_POST_IMAGES}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => requestMedia('video')}
            style={({pressed}) => [
              styles.mediaButton,
              pressed && styles.pressedButton,
            ]}
          >
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="video-outline"
              size={25}
            />
            <Text style={styles.mediaButtonText}>영상</Text>
          </Pressable>
        </View>

        {imageMedia.length > 0 ? (
          <PostImageCarousel
            images={imageMedia}
            onRemove={imageId =>
              setMedia(current => current.filter(item => item.id !== imageId))
            }
          />
        ) : null}

        {video ? (
          <VideoPreview
            media={video}
            onRemove={() => setMedia(current => current.filter(item => item.id !== video.id))}
          />
        ) : null}

        <UploadStatusBanner
          onRetry={onRetryUpload}
          uploadState={uploadState}
        />
      </ScrollView>
    </View>
  );
}

interface VideoPreviewProps {
  media: LocalMedia;
  onRemove: () => void;
}

function VideoPreview({media, onRemove}: VideoPreviewProps) {
  const durationSeconds = media.durationSeconds
    ? Math.round(media.durationSeconds)
    : null;

  return (
    <View style={styles.videoPreview}>
      <View style={styles.videoThumbnail}>
        {media.thumbnailSource ? (
          <Image
            accessibilityLabel="선택한 영상 썸네일"
            resizeMode="cover"
            source={media.thumbnailSource}
            style={styles.videoThumbnailImage}
          />
        ) : (
          <View
            accessibilityLabel="영상 썸네일 준비 전"
            style={styles.videoThumbnailPlaceholder}
          >
            <MaterialDesignIcons
              color={COLORS.purpleDeep}
              name="video-outline"
              size={30}
            />
          </View>
        )}
        <View style={styles.videoPlayIcon}>
          <MaterialDesignIcons
            color={COLORS.background}
            name="play-circle-outline"
            size={38}
          />
        </View>
      </View>
      <View style={styles.videoText}>
        <Text numberOfLines={1} style={styles.videoName}>
          {media.fileName ?? '선택한 영상'}
        </Text>
        <Text style={styles.videoDuration}>
          {durationSeconds === null
            ? '재생시간 확인 전'
            : `${Math.floor(durationSeconds / 60)}:${String(
                durationSeconds % 60,
              ).padStart(2, '0')}`}
        </Text>
      </View>
      <Pressable
        accessibilityLabel="선택한 영상 제거"
        accessibilityRole="button"
        onPress={onRemove}
        style={styles.videoRemove}
      >
        <MaterialDesignIcons color={COLORS.textMuted} name="close" size={22} />
      </Pressable>
    </View>
  );
}

interface UploadStatusBannerProps {
  onRetry?: () => void;
  uploadState: UploadState;
}

function UploadStatusBanner({
  onRetry,
  uploadState,
}: UploadStatusBannerProps) {
  if (uploadState.status === 'idle') {
    return null;
  }

  const labels: Record<Exclude<UploadState['status'], 'idle'>, string> = {
    cancelled: '업로드가 취소됐어요.',
    failure: uploadState.status === 'failure' ? uploadState.message : '',
    preparing: '미디어를 준비하고 있어요.',
    success: '업로드를 완료했어요.',
    uploading:
      uploadState.status === 'uploading'
        ? `업로드 중 ${Math.round(uploadState.progress * 100)}%`
        : '',
  };

  return (
    <View accessibilityLiveRegion="polite" style={styles.uploadBanner}>
      <Text style={styles.uploadText}>{labels[uploadState.status]}</Text>
      {uploadState.status === 'failure' && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={styles.retryUploadText}>다시 시도</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    flex: 1,
  },
  content: {
    gap: 18,
    paddingBottom: 40,
    paddingTop: 18,
  },
  counter: {
    color: COLORS.textDisabled,
    fontSize: 12,
    textAlign: 'right',
  },
  disabledSubmitText: {
    color: COLORS.textDisabled,
  },
  header: {
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
    paddingHorizontal: 8,
  },
  headerButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 140,
    padding: 0,
  },
  inputSection: {
    backgroundColor: COLORS.surface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    gap: 8,
    marginHorizontal: 20,
    padding: 16,
  },
  mediaActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  mediaButton: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  mediaButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  mediaCount: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  pressedButton: {
    backgroundColor: COLORS.lavender,
  },
  retryUploadText: {
    color: COLORS.purpleDeep,
    fontSize: 13,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 52,
  },
  submitText: {
    color: COLORS.purpleDeep,
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    color: COLORS.textStrong,
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  uploadBanner: {
    alignItems: 'center',
    backgroundColor: COLORS.lemon,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  uploadText: {
    color: COLORS.text,
    flex: 1,
    fontSize: 13,
  },
  videoDuration: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  videoName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  videoPreview: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    minHeight: 96,
    paddingHorizontal: 16,
  },
  videoRemove: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  videoText: {
    flex: 1,
    gap: 4,
  },
  videoPlayIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.imageOverlay,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
  },
  videoThumbnail: {
    backgroundColor: COLORS.textMuted,
    borderCurve: 'continuous',
    borderRadius: RADII.small,
    height: 68,
    overflow: 'hidden',
    position: 'relative',
    width: 68,
  },
  videoThumbnailImage: {
    height: '100%',
    width: '100%',
  },
  videoThumbnailPlaceholder: {
    alignItems: 'center',
    backgroundColor: COLORS.lavenderSurface,
    height: '100%',
    justifyContent: 'center',
    width: '100%',
  },
});
