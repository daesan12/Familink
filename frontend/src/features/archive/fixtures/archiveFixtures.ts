import type {ImageSourcePropType} from 'react-native';

import type {ArchiveMember, ArchivePost} from '../types';

const GYEONGJU_TEMPLE =
  require('../../../assets/images/feed-gyeongju-temple.png') as ImageSourcePropType;
const KOREAN_BARBECUE =
  require('../../../assets/images/feed-korean-barbecue.png') as ImageSourcePropType;
const GYEONGJU_BRIDGE =
  require('../../../assets/images/feed-gyeongju-bridge.png') as ImageSourcePropType;
const KOREAN_DESSERT =
  require('../../../assets/images/feed-korean-dessert.png') as ImageSourcePropType;

export const DEVELOPMENT_ARCHIVE_MEMBERS: readonly ArchiveMember[] = [
  {avatarText: '유', id: 'member-yura', name: '홍유라'},
  {avatarText: '종', id: 'member-jongcheol', name: '이종철'},
  {avatarText: '대', id: 'member-daesan', name: '장대산'},
  // 가족 구성원이지만 아직 보관함에 올린 게시글이 없는 사람들.
  // 선택하면 "작성한 게시글이 없어요" 안내가 노출된다.
  {avatarText: '다', id: 'member-dayoung', name: '강다영'},
  {avatarText: '수', id: 'member-suho', name: '손수호'},
  {avatarText: '경', id: 'member-gyeongho', name: '이경호'},
];

// 메인 피드의 게시글과 동일한 구성. 홍유라만 경주 여행 사진 4장을 올렸고,
// 이종철과 장대산은 각각 글 1개를 올렸다. 모두 어제(2026-07-29) 작성분이다.
const AUTHORED_DATE = '2026-07-29';
// 썸네일을 누르면 이동할 피드 게시글이 속한 그룹.
const ARCHIVE_GROUP_ID = 'development-guardian-group';

export const DEVELOPMENT_ARCHIVE_POSTS: readonly ArchivePost[] = [
  {
    dateKey: AUTHORED_DATE,
    groupId: ARCHIVE_GROUP_ID,
    id: 'archive-yura-temple',
    mediaKind: 'image',
    memberId: 'member-yura',
    postId: 'post-gyeongju',
    thumbnail: GYEONGJU_TEMPLE,
    thumbnailAccessibilityLabel: '홍유라님이 올린 경주 불국사 다보탑 사진',
  },
  {
    dateKey: AUTHORED_DATE,
    groupId: ARCHIVE_GROUP_ID,
    id: 'archive-yura-barbecue',
    mediaKind: 'image',
    memberId: 'member-yura',
    postId: 'post-gyeongju',
    thumbnail: KOREAN_BARBECUE,
    thumbnailAccessibilityLabel: '홍유라님이 올린 가족과 함께한 식사 사진',
  },
  {
    dateKey: AUTHORED_DATE,
    groupId: ARCHIVE_GROUP_ID,
    id: 'archive-yura-bridge',
    mediaKind: 'image',
    memberId: 'member-yura',
    postId: 'post-gyeongju',
    thumbnail: GYEONGJU_BRIDGE,
    thumbnailAccessibilityLabel: '홍유라님이 올린 야경 속 경주 월정교 사진',
  },
  {
    dateKey: AUTHORED_DATE,
    groupId: ARCHIVE_GROUP_ID,
    id: 'archive-yura-dessert',
    mediaKind: 'image',
    memberId: 'member-yura',
    postId: 'post-gyeongju',
    thumbnail: KOREAN_DESSERT,
    thumbnailAccessibilityLabel: '홍유라님이 올린 한식 디저트와 음료 사진',
  },
  {
    dateKey: AUTHORED_DATE,
    groupId: ARCHIVE_GROUP_ID,
    id: 'archive-jongcheol-text',
    mediaKind: 'text',
    memberId: 'member-jongcheol',
    postId: 'post-recital',
    text: '어머니 손주 민수가 오늘 발표회에서 춤 춰서 영상 보여드리고 싶어서 올려봐요',
  },
  {
    dateKey: AUTHORED_DATE,
    groupId: ARCHIVE_GROUP_ID,
    id: 'archive-daesan-text',
    mediaKind: 'text',
    memberId: 'member-daesan',
    postId: 'post-love',
    text: '할머니 사랑해요!! 내가 진짜 사랑해!!',
  },
];
