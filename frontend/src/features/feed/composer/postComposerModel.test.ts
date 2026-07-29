import {
  buildPostSubmitPayload,
  canAddMedia,
  hasComposerChanges,
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
const initial: PostComposerInitialValue = {
  body: '기존 본문',
  media: [remote],
  postId: 'post-1',
};

test('사진과 영상을 함께 선택하지 않고 사진은 네 장으로 제한한다', () => {
  expect(canAddMedia([remote], 'video')).toBe('confirm-replace');
  expect(canAddMedia([local, local, local, local], 'image')).toBe('image-limit');
});

test('수정 payload가 유지, 삭제, 신규 미디어를 구분한다', () => {
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
