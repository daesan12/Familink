import {limitPostImages, MAX_POST_IMAGES, type FeedImage} from './types';

function createImage(index: number): FeedImage {
  return {
    accessibilityLabel: `${index}번째 이미지`,
    id: `image-${index}`,
    source: index,
  };
}

test('게시글 이미지는 선택 순서를 유지하며 최대 4장으로 제한한다', () => {
  const images = Array.from({length: 6}, (_, index) => createImage(index + 1));

  const result = limitPostImages(images);

  expect(result).toHaveLength(MAX_POST_IMAGES);
  expect(result.map(image => image.id)).toEqual([
    'image-1',
    'image-2',
    'image-3',
    'image-4',
  ]);
});
