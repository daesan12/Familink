import {useMemo} from 'react';

import type {AppScreenProps} from '../../../app-shell';
import {createInterestGateway, type InterestGateway} from '../../auth';
import {createProfileGateway, type ProfileGateway} from '../api/profileApi';
import {CareReceiverMyPageScreen} from './CareReceiverMyPageScreen';
import {MyPageScreen} from './MyPageScreen';

interface ProfileTabScreenProps extends AppScreenProps {
  interestGateway?: InterestGateway;
  profileGateway?: ProfileGateway;
}

// 마이페이지(프로필) 탭 진입점. 현재 그룹에서의 역할에 따라 화면을 고른다.
// 보호자는 효자 도장(I-1), 피보호자는 관심사 설정(J-1)을 본다.
export function ProfileTabScreen(props: ProfileTabScreenProps) {
  const interestGateway = useMemo(
    () =>
      props.interestGateway ??
      (props.authSession === undefined
        ? undefined
        : createInterestGateway({
            authSession: props.authSession,
            baseUrl: props.apiBaseUrl,
          })),
    [props.apiBaseUrl, props.authSession, props.interestGateway],
  );
  const profileGateway = useMemo(
    () =>
      props.profileGateway ??
      (props.authSession === undefined
        ? undefined
        : createProfileGateway({
            authSession: props.authSession,
            baseUrl: props.apiBaseUrl,
          })),
    [props.apiBaseUrl, props.authSession, props.profileGateway],
  );

  const fallbackWithdrawal =
    profileGateway === undefined
      ? undefined
      : async () => {
          await profileGateway.withdrawCurrentUser();
          try {
            await props.onRequestLogout?.();
          } catch {
            // 회원 탈퇴가 성공한 뒤 로그아웃 요청이 거절되어도 로컬 인증정보는
            // onRequestLogout 내부에서 정리하도록 맡긴다.
          }
        };
  const withdrawalHandler = props.onRequestWithdrawal ?? fallbackWithdrawal;

  if (props.role === 'careReceiver') {
    return (
      <CareReceiverMyPageScreen
        {...props}
        interestGateway={interestGateway}
        onRequestWithdrawal={withdrawalHandler}
        profileGateway={profileGateway}
      />
    );
  }
  return (
    <MyPageScreen
      {...props}
      onRequestWithdrawal={withdrawalHandler}
      profileGateway={profileGateway}
    />
  );
}
