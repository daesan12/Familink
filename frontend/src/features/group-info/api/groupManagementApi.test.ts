jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {
  changeManager,
  deleteGroup,
  leaveGroup,
  removeMember,
} from './groupManagementApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: '성공', success: true},
    status,
  } as never;
}

function noContent() {
  return {data: '', status: 204} as never;
}

describe('groupManagementApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('관리자 위임 요청과 응답을 계약대로 변환한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({groupId: 11, managerMemberId: 21}),
    );

    await expect(changeManager('11', '21')).resolves.toEqual({
      groupId: '11',
      managerMemberId: '21',
    });
    expect(apiClient.patch).toHaveBeenCalledWith('/groups/11/manager', {
      newManagerMemberId: 21,
    });
  });

  it('내보내기·탈퇴는 204 응답을 성공으로 처리한다', async () => {
    const deleteSpy = jest
      .spyOn(apiClient, 'delete')
      .mockResolvedValue(noContent());

    await expect(removeMember('11', '21')).resolves.toBeUndefined();
    await expect(leaveGroup('11')).resolves.toBeUndefined();

    expect(deleteSpy).toHaveBeenNthCalledWith(
      1,
      '/groups/11/members/21',
    );
    expect(deleteSpy).toHaveBeenNthCalledWith(2, '/groups/11/leave');
  });

  it('그룹 삭제는 확인용 이름을 trim해 body로 전달한다', async () => {
    jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(noContent());

    await expect(deleteGroup('11', '  우리 가족  ')).resolves.toBeUndefined();
    expect(apiClient.delete).toHaveBeenCalledWith('/groups/11', {
      data: {confirmationName: '우리 가족'},
    });
  });

  it('관리자 위임 응답의 대상 식별자가 요청과 다르면 거부한다', async () => {
    jest.spyOn(apiClient, 'patch').mockResolvedValueOnce(
      success({groupId: 11, managerMemberId: 99}),
    );

    await expect(changeManager('11', '21')).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('삭제 API가 204가 아니면 계약 위반으로 처리한다', async () => {
    jest.spyOn(apiClient, 'delete').mockResolvedValueOnce(success(null));

    await expect(leaveGroup('11')).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('서버 권한 오류는 원래 ApiError를 호출자에게 전달한다', async () => {
    const forbidden = new ApiError({
      code: 'FORBIDDEN',
      kind: 'server',
      message: 'forbidden',
      status: 403,
    });
    jest.spyOn(apiClient, 'delete').mockRejectedValueOnce(forbidden);

    await expect(removeMember('11', '21')).rejects.toBe(forbidden);
  });

  it('관리자 위임 ID와 삭제 확인 이름을 로컬에서 검증한다', async () => {
    const patchSpy = jest.spyOn(apiClient, 'patch');
    const deleteSpy = jest.spyOn(apiClient, 'delete');

    await expect(changeManager('11', 'member-21')).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});
    await expect(deleteGroup('11', '   ')).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});

    expect(patchSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});
