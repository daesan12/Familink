import {ApiError} from '../../../shared/api';
import {joinRequestErrorMessage} from './JoinGroupSheet';

const apiError = (code: string, status: number): ApiError =>
  new ApiError({code, kind: 'server', message: 'error', status});

describe('joinRequestErrorMessage', () => {
  test('중복 신청 409는 승인 대기 문구를 보여준다', () => {
    expect(
      joinRequestErrorMessage(apiError('JOIN_REQUEST_ALREADY_EXISTS', 409)),
    ).toBe('이미 참여 요청을 보낸 그룹이에요. 관리자의 승인을 기다려 주세요.');
  });

  test('이미 구성원인 409는 참여 중 문구를 보여준다', () => {
    expect(
      joinRequestErrorMessage(apiError('ALREADY_GROUP_MEMBER', 409)),
    ).toBe('이미 참여하고 있는 그룹이에요.');
  });

  test('잘못된 코드 400 등 그 외 오류는 코드 확인 문구를 보여준다', () => {
    expect(
      joinRequestErrorMessage(apiError('INVITE_CODE_INVALID', 400)),
    ).toBe('초대 코드를 확인하고 다시 시도해주세요.');
    expect(joinRequestErrorMessage(new Error('network'))).toBe(
      '초대 코드를 확인하고 다시 시도해주세요.',
    );
  });
});
