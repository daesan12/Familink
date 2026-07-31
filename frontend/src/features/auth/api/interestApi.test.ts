jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {API_BASE_URL: 'http://10.0.2.2:8080'},
}));

import {ApiError, apiClient} from '../../../shared/api';
import {loadInterests, replaceInterests} from './interestApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

describe('interestApi', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('관심사 조회 응답을 화면 모델로 변환한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({memberId: 21, interests: ['산책', '음악']}),
    );

    await expect(loadInterests('11', '21')).resolves.toEqual({
      memberId: '21',
      interests: ['산책', '음악'],
    });
    expect(apiClient.get).toHaveBeenCalledWith(
      '/groups/11/members/21/interests',
    );
  });

  it('관심사 수정 요청은 trim·중복 제거 후 전체 목록으로 보낸다', async () => {
    jest.spyOn(apiClient, 'put').mockResolvedValueOnce(
      success({memberId: 21, interests: ['산책', '음악']}),
    );

    await expect(
      replaceInterests('11', '21', [' 산책 ', '음악', '산책']),
    ).resolves.toEqual({
      memberId: '21',
      interests: ['산책', '음악'],
    });
    expect(apiClient.put).toHaveBeenCalledWith(
      '/groups/11/members/21/interests',
      {interests: ['산책', '음악']},
    );
  });

  it('응답 memberId가 요청과 다르면 잘못된 응답으로 거부한다', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValueOnce(
      success({memberId: 99, interests: []}),
    );

    await expect(loadInterests('11', '21')).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('빈 값·10자 초과·11개 초과 입력은 API를 호출하지 않는다', async () => {
    const putSpy = jest.spyOn(apiClient, 'put');

    await expect(replaceInterests('11', '21', ['   '])).rejects.toMatchObject<
      Partial<ApiError>
    >({code: 'INVALID_REQUEST'});
    await expect(
      replaceInterests('11', '21', ['12345678901']),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});
    await expect(
      replaceInterests(
        '11',
        '21',
        Array.from({length: 11}, (_, index) => `관심${index}`),
      ),
    ).rejects.toMatchObject<Partial<ApiError>>({code: 'INVALID_REQUEST'});

    expect(putSpy).not.toHaveBeenCalled();
  });

  it('서버 ApiError는 호출자에게 그대로 전달한다', async () => {
    const forbidden = new ApiError({
      code: 'FORBIDDEN',
      kind: 'server',
      message: 'forbidden',
      status: 403,
    });
    jest.spyOn(apiClient, 'put').mockRejectedValueOnce(forbidden);

    await expect(replaceInterests('11', '21', ['산책'])).rejects.toBe(forbidden);
  });
});
