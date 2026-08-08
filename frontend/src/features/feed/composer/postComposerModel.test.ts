import {
  buildPostSubmitPayload,
  canAddMedia,
  describeMediaReplace,
  hasComposerChanges,
  validatePickedMedia,
  type ComposerMedia,
  type PostComposerInitialValue,
} from './postComposerModel';

const remote: ComposerMedia = {
  id: 'remote-1',
  kind: 'image',
  source: 1,
  sourceType: 'remote',
};
const local: ComposerMedia = {
  id: 'local-1',
  kind: 'image',
  source: {uri: 'file://image.jpg'},
  sourceType: 'local',
};
const video: ComposerMedia = {
  id: 'local-video-1',
  kind: 'video',
  source: {uri: 'file://video.mp4'},
  sourceType: 'local',
};
const initial: PostComposerInitialValue = {
  body: '기존 본문',
  media: [remote],
  postId: 'post-1',
};

test('images and videos cannot be selected together and image count is limited', () => {
  expect(canAddMedia([remote], 'video')).toBe('confirm-replace');
  expect(canAddMedia([local, local, local, local], 'image')).toBe('image-limit');
});

test('선택된 영상을 다시 영상으로 바꾸는 것도 교체 확인 대상이다', () => {
  expect(canAddMedia([video], 'video')).toBe('confirm-replace');
  expect(canAddMedia([video], 'image')).toBe('confirm-replace');
});

test('교체 확인 문구는 현재 선택한 미디어 종류를 기준으로 만든다', () => {
  expect(describeMediaReplace([video], 'video')).toEqual({
    message: '교체하면 현재 선택한 영상이 제거돼요.',
    title: '선택한 영상을 교체할까요?',
  });
  expect(describeMediaReplace([video], 'image')).toEqual({
    message: '교체하면 현재 선택한 영상이 제거돼요.',
    title: '영상을 사진으로 교체할까요?',
  });
  expect(describeMediaReplace([remote, local], 'video')).toEqual({
    message: '교체하면 현재 선택한 사진이 제거돼요.',
    title: '사진을 영상으로 교체할까요?',
  });
});

test('edit payload separates retained, deleted, and new media', () => {
  const result = buildPostSubmitPayload(initial, '변경 본문', [local]);

  expect(result).toMatchObject({
    body: '변경 본문',
    deletedMediaIds: ['remote-1'],
    postId: 'post-1',
    retainedMediaIds: [],
  });
  expect(result.newMedia).toEqual([local]);
  expect(hasComposerChanges(initial, '변경 본문', [local])).toBe(true);
});

test('media size, type, and video duration are validated before upload', () => {
  expect(
    validatePickedMedia('image', {
      contentType: 'image/jpeg',
      fileSizeBytes: 10 * 1024 * 1024,
    }),
  ).toBeNull();
  expect(
    validatePickedMedia('image', {
      contentType: 'image/jpeg',
      fileSizeBytes: 10 * 1024 * 1024 + 1,
    }),
  ).toBe('size');
  expect(
    validatePickedMedia('video', {
      contentType: 'video/mp4',
      fileSizeBytes: 100 * 1024 * 1024,
      durationSeconds: 60,
    }),
  ).toBeNull();
  expect(
    validatePickedMedia('video', {
      contentType: 'video/mp4',
      durationSeconds: 60.01,
    }),
  ).toBe('duration');
  expect(validatePickedMedia('video', {contentType: 'video/webm'})).toBe(
    'type',
  );
});
