import type {ImageSourcePropType} from 'react-native';

export interface ArchiveMember {
  avatarText: string;
  id: string;
  name: string;
}

export type ArchiveMediaKind = 'image' | 'video' | 'text';

export interface ArchivePost {
  // 'YYYY-MM-DD' 형식. 날짜 그룹핑과 달력 활성 날짜 계산에 사용한다.
  dateKey: string;
  // 썸네일을 누르면 이동할 피드 게시글이 속한 그룹 ID.
  groupId: string;
  id: string;
  mediaKind: ArchiveMediaKind;
  // API-POSTS-003는 전체 보관함 결과에 작성자 memberId를 포함하지 않는다.
  // 구성원 필터 조회 결과에서는 요청한 memberId를 채우고, 전체 조회는 null이다.
  memberId: string | null;
  // 썸네일을 누르면 이동할 피드 게시글 ID.
  postId: string;
  // 이미지·비디오 게시글의 썸네일. 텍스트 게시글에는 없다.
  thumbnail?: ImageSourcePropType;
  // 이미지·비디오 게시글의 접근성 라벨.
  thumbnailAccessibilityLabel?: string;
  // 텍스트 게시글 본문.
  text?: string;
}

export interface ArchiveDateGroup {
  dateKey: string;
  dateLabel: string;
  posts: readonly ArchivePost[];
}

// 구성원 필터 선택값. null은 '모두'를 의미한다.
export type ArchiveMemberFilter = string | null;
