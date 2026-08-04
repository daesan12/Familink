import {useEffect, useRef, useState} from 'react';

import type {CarnationCalendar, MemberCarnationLoader} from '../api/carnationApi';
import type {
  GroupMembersLoader,
  MemberProfile,
  MemberProfileLoader,
} from '../api/groupMemberApi';
import type {WeeklyRankingLoader} from '../api/rankingApi';
import {getCurrentWeekRange, rankEntries} from '../rankingModel';
import type {GroupMember, WeeklyRankingSnapshot} from '../types';
import {MemberProfileModal} from './MemberProfileModal';

// 팝업이 뜨자마자 이름을 보여줄 수 있도록 호출 화면이 이미 아는 값만 받는다.
export interface MemberProfilePopupInitialMember {
  memberId: string;
  name: string;
  avatarText: string;
}

export interface MemberProfilePopupProps {
  groupId: string;
  memberId: string;
  // 호출 화면이 이미 아는 표시 정보. 구성원 조회가 끝나기 전 헤더에 쓴다.
  initialMember?: MemberProfilePopupInitialMember;
  membersLoader: GroupMembersLoader;
  memberProfileLoader?: MemberProfileLoader;
  memberCarnationLoader?: MemberCarnationLoader;
  rankingLoader?: WeeklyRankingLoader;
  onClose: () => void;
}

interface PopupData {
  base: GroupMember | null;
  profile: MemberProfile | null;
  stamps: readonly boolean[] | null;
  ranking: WeeklyRankingSnapshot | null;
}

const EMPTY_DATA: PopupData = {
  base: null,
  profile: null,
  ranking: null,
  stamps: null,
};

// 그룹정보 화면(H-1p)과 동일한 축소 프로필 팝업을, 구성원 목록을 미리 들고 있지
// 않은 화면(피드 등)에서도 띄울 수 있도록 데이터 조회까지 감싼 컴포넌트.
// 조회 흐름은 GroupInfoScreen의 프로필 팝업과 같다: 구성원 목록에서 대상을 찾고
// 프로필 상세·(보호자면) 주간 카네이션·랭킹을 병렬로 불러와 머지한다.
export function MemberProfilePopup({
  groupId,
  memberId,
  initialMember,
  membersLoader,
  memberProfileLoader,
  memberCarnationLoader,
  rankingLoader,
  onClose,
}: MemberProfilePopupProps) {
  const [data, setData] = useState<PopupData>(EMPTY_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const requestVersion = useRef(0);

  useEffect(() => {
    let isActive = true;
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    const isCurrent = () =>
      isActive && requestVersion.current === version;

    setData(EMPTY_DATA);
    setIsLoading(true);
    setErrorMessage(null);

    void (async () => {
      let base: GroupMember | undefined;
      try {
        const members = await membersLoader(groupId);
        base = members.find(member => member.memberId === memberId);
      } catch {
        if (isCurrent()) {
          setIsLoading(false);
          setErrorMessage(
            '구성원 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
          );
        }
        return;
      }

      if (!isCurrent()) {
        return;
      }
      if (base === undefined) {
        setIsLoading(false);
        setErrorMessage('그룹에서 구성원을 찾을 수 없어요.');
        return;
      }
      const foundBase = base;
      setData(current => ({...current, base: foundBase}));

      const isGuardian = foundBase.role === 'guardian';
      const week = getCurrentWeekRange(new Date());
      const profileRequest: Promise<MemberProfile | null> =
        memberProfileLoader === undefined
          ? Promise.resolve(null)
          : memberProfileLoader(groupId, memberId);
      const carnationRequest: Promise<CarnationCalendar | null> =
        memberCarnationLoader === undefined || !isGuardian
          ? Promise.resolve(null)
          : memberCarnationLoader(
              groupId,
              memberId,
              week.weekStart,
              week.weekEnd,
            );
      // 랭킹은 부가 정보라 실패해도 팝업 자체는 유지한다(그룹정보 화면과 동일).
      const rankingRequest: Promise<WeeklyRankingSnapshot | null> =
        rankingLoader === undefined || !isGuardian
          ? Promise.resolve(null)
          : rankingLoader(groupId).catch(() => null);

      const [profileResult, carnationResult, rankingResult] =
        await Promise.allSettled([
          profileRequest,
          carnationRequest,
          rankingRequest,
        ]);
      if (!isCurrent()) {
        return;
      }

      if (profileResult.status === 'rejected') {
        setIsLoading(false);
        setErrorMessage('프로필을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      if (carnationResult.status === 'rejected') {
        setIsLoading(false);
        setErrorMessage(
          '카네이션 활동을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
        );
        return;
      }

      setData(current => ({
        ...current,
        profile: profileResult.value,
        ranking:
          rankingResult.status === 'fulfilled' ? rankingResult.value : null,
        stamps:
          carnationResult.value === null
            ? null
            : toWeeklyStamps(carnationResult.value),
      }));
      setIsLoading(false);
    })();

    return () => {
      isActive = false;
    };
  }, [
    groupId,
    memberCarnationLoader,
    memberId,
    memberProfileLoader,
    membersLoader,
    rankingLoader,
    reloadCount,
  ]);

  const placeholderMember: GroupMember | null =
    initialMember === undefined
      ? null
      : {
          age: null,
          alias: null,
          avatarText: initialMember.avatarText,
          gender: null,
          isManager: false,
          memberId: initialMember.memberId,
          name: initialMember.name,
          role: 'careReceiver',
        };

  const baseMember = data.base ?? placeholderMember;
  const rankingEntry =
    data.ranking === null || baseMember === null
      ? undefined
      : rankEntries(data.ranking.rankings).find(
          entry => entry.memberId === baseMember.memberId,
        );
  const member: GroupMember | null =
    baseMember === null
      ? null
      : {
          ...baseMember,
          ...(rankingEntry === undefined
            ? {}
            : {
                previousWeekWinner: rankingEntry.previousWeekWinner,
                weeklyRank: rankingEntry.rank,
              }),
          ...(data.stamps === null ? {} : {weeklyStamps: data.stamps}),
          ...(data.profile === null
            ? {}
            : {
                age: data.profile.age,
                gender: data.profile.gender,
                name: data.profile.displayName,
                alias: null,
              }),
        };

  return (
    <MemberProfileModal
      errorMessage={errorMessage}
      isLoading={isLoading}
      member={member}
      onClose={onClose}
      onRetry={() => setReloadCount(count => count + 1)}
    />
  );
}

function toWeeklyStamps(calendar: CarnationCalendar): readonly boolean[] {
  const earnedDates = new Set(calendar.earnedDates);
  const start = new Date(`${calendar.startDate}T00:00:00Z`);
  return Array.from({length: 7}, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return earnedDates.has(date.toISOString().slice(0, 10));
  });
}
