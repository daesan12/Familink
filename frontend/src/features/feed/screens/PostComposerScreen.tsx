import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  KeyboardAvoidingView,
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
import {BackButton} from '../../../shared/components/BackButton';
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
  const isUploadBusy =
    uploadState.status === 'preparing' || uploadState.status === 'uploading';
  const canSubmit =
    !isUploadBusy &&
    body.trim().length > 0 &&
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
    (item): item is ComposerMedia => item.kind === 'video',
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
    if (isUploadBusy) {
      return;
    }
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
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <View style={styles.header}>
        <BackButton
          accessibilityLabel="게시글 작성 닫기"
          onPress={requestClose}
        />
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
            editable={!isUploadBusy}
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
            accessibilityLabel="사진 선택"
            accessibilityRole="button"
            accessibilityState={{disabled: isUploadBusy}}
            disabled={isUploadBusy}
            onPress={() => requestMedia('image')}
            style={({pressed}) => [
              styles.mediaButton,
              isUploadBusy && styles.disabledMediaButton,
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
            accessibilityLabel="영상 선택"
            accessibilityRole="button"
            accessibilityState={{disabled: isUploadBusy}}
            disabled={isUploadBusy}
            onPress={() => requestMedia('video')}
            style={({pressed}) => [
              styles.mediaButton,
              isUploadBusy && styles.disabledMediaButton,
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
            onRemove={
              isUploadBusy
                ? undefined
                : imageId =>
                    setMedia(current =>
                      current.filter(item => item.id !== imageId),
                    )
            }
          />
        ) : null}

        {video ? (
          <VideoPreview
            media={video}
            onRemove={
              isUploadBusy
                ? undefined
                : () =>
                    setMedia(current =>
                      current.filter(item => item.id !== video.id),
                    )
            }
          />
        ) : null}

        <UploadStatusCard
          mediaKind={video ? 'video' : imageMedia.length > 0 ? 'image' : null}
          onRetry={onRetryUpload}
          uploadState={uploadState}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

interface VideoPreviewProps {
  media: ComposerMedia;
  onRemove?: () => void;
}

function VideoPreview({media, onRemove}: VideoPreviewProps) {
  const localMedia = media.sourceType === 'local' ? media : null;
  const durationSeconds = localMedia?.durationSeconds
    ? Math.round(localMedia.durationSeconds)
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
          {localMedia?.fileName ?? '선택한 영상'}
        </Text>
        <Text style={styles.videoDuration}>
          {durationSeconds === null
            ? '재생시간 확인 전'
            : `${Math.floor(durationSeconds / 60)}:${String(
                durationSeconds % 60,
              ).padStart(2, '0')}`}
        </Text>
      </View>
      {onRemove ? (
        <Pressable
          accessibilityLabel="선택한 영상 제거"
          accessibilityRole="button"
          onPress={onRemove}
          style={styles.videoRemove}
        >
          <MaterialDesignIcons color={COLORS.textMuted} name="close" size={22} />
        </Pressable>
      ) : null}
    </View>
  );
}

interface UploadStatusCardProps {
  mediaKind: LocalMedia['kind'] | null;
  onRetry?: () => void;
  uploadState: UploadState;
}

function UploadStatusCard({
  mediaKind,
  onRetry,
  uploadState,
}: UploadStatusCardProps) {
  if (uploadState.status === 'idle') {
    return null;
  }

  const mediaLabel =
    mediaKind === 'video' ? '영상' : mediaKind === 'image' ? '사진' : '미디어';
  const percentage =
    uploadState.status === 'uploading'
      ? Math.round(Math.max(0, Math.min(uploadState.progress, 1)) * 100)
      : 0;
  const copy: Record<
    Exclude<UploadState['status'], 'idle'>,
    {description: string; title: string}
  > = {
    cancelled: {
      description: '작성 내용은 그대로 남아 있어요.',
      title: '업로드가 취소됐어요',
    },
    failure: {
      description:
        uploadState.status === 'failure'
          ? uploadState.message
          : '잠시 후 다시 시도해 주세요.',
      title: '업로드하지 못했어요',
    },
    preparing: {
      description: '업로드 전에 파일을 최적화하고 있어요.',
      title: `${mediaLabel} 준비 중`,
    },
    success: {
      description: '가족 피드에 게시글을 반영하고 있어요.',
      title: '업로드를 완료했어요',
    },
    uploading: {
      description: '앱을 닫지 말고 잠시만 기다려 주세요.',
      title: `${mediaLabel} 업로드 중`,
    },
  };
  const currentCopy = copy[uploadState.status];
  const isBusy =
    uploadState.status === 'preparing' || uploadState.status === 'uploading';
  const isFailure = uploadState.status === 'failure';
  const statusIcon =
    uploadState.status === 'success'
      ? 'check'
      : uploadState.status === 'failure'
        ? 'alert-circle-outline'
        : uploadState.status === 'cancelled'
          ? 'close'
          : 'cloud-upload-outline';

  return (
    <View
      accessibilityLabel={
        uploadState.status === 'uploading'
          ? `${currentCopy.title} ${percentage}%`
          : currentCopy.title
      }
      accessibilityLiveRegion="polite"
      style={[styles.uploadCard, isFailure && styles.uploadFailureCard]}
    >
      <View style={styles.uploadStatusRow}>
        <View
          style={[
            styles.uploadStatusCircle,
            isFailure && styles.uploadFailureCircle,
          ]}
        >
          {isBusy ? (
            <ActivityIndicator
              color={isFailure ? COLORS.error : COLORS.purple}
              size="large"
              style={styles.uploadSpinner}
            />
          ) : null}
          {uploadState.status === 'uploading' ? (
            <Text style={styles.uploadPercentage}>{percentage}%</Text>
          ) : (
            <MaterialDesignIcons
              color={isFailure ? COLORS.error : COLORS.purpleDeep}
              name={statusIcon}
              size={22}
            />
          )}
        </View>

        <View style={styles.uploadCopy}>
          <Text style={styles.uploadTitle}>{currentCopy.title}</Text>
          <Text
            accessibilityRole={isFailure ? 'alert' : undefined}
            style={styles.uploadDescription}
          >
            {currentCopy.description}
          </Text>
        </View>

        {isFailure && onRetry ? (
          <Pressable
            accessibilityLabel="미디어 업로드 다시 시도"
            accessibilityRole="button"
            hitSlop={6}
            onPress={onRetry}
            style={({pressed}) => [
              styles.uploadRetryButton,
              pressed && styles.uploadRetryButtonPressed,
            ]}
          >
            <Text style={styles.uploadRetryText}>다시 시도</Text>
          </Pressable>
        ) : null}
      </View>

      {uploadState.status === 'uploading' ? (
        <View
          accessibilityRole="progressbar"
          accessibilityValue={{max: 100, min: 0, now: percentage}}
          style={styles.uploadProgressTrack}
        >
          <View
            style={[styles.uploadProgressFill, {width: `${percentage}%`}]}
          />
        </View>
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
  disabledMediaButton: {
    opacity: 0.5,
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
  uploadCard: {
    backgroundColor: COLORS.lavenderSurface,
    borderColor: COLORS.lavender,
    borderCurve: 'continuous',
    borderRadius: RADII.medium,
    borderWidth: 1,
    gap: 14,
    marginHorizontal: 20,
    padding: 16,
  },
  uploadCopy: {
    flex: 1,
    gap: 3,
  },
  uploadDescription: {
    color: COLORS.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  uploadFailureCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.error,
  },
  uploadFailureCircle: {
    backgroundColor: COLORS.background,
  },
  uploadPercentage: {
    color: COLORS.purpleDeep,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  uploadProgressFill: {
    backgroundColor: COLORS.purple,
    borderRadius: RADII.pill,
    height: '100%',
  },
  uploadProgressTrack: {
    backgroundColor: COLORS.lavender,
    borderRadius: RADII.pill,
    height: 7,
    overflow: 'hidden',
  },
  uploadRetryButton: {
    alignItems: 'center',
    borderColor: COLORS.purple,
    borderRadius: RADII.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  uploadRetryButtonPressed: {
    backgroundColor: COLORS.lavender,
  },
  uploadRetryText: {
    color: COLORS.purpleDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  uploadSpinner: {
    position: 'absolute',
  },
  uploadStatusCircle: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADII.pill,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  uploadStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  uploadTitle: {
    color: COLORS.textStrong,
    fontSize: 14,
    fontWeight: '700',
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
