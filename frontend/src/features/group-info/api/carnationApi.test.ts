import {ApiError} from '../../../shared/api';
import {
  createCarnationGateway,
  type CarnationHttpClient,
} from './carnationApi';

function success(data: unknown, status = 200) {
  return {
    data: {data, message: 'ok', success: true},
    status,
  } as never;
}

function createClient(): jest.Mocked<CarnationHttpClient> {
  return {get: jest.fn()} as unknown as jest.Mocked<CarnationHttpClient>;
}

describe('carnationApi', () => {
  it('기본 주간 범위의 잔디 랭킹을 API 계약에 맞게 읽는다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({
        rankings: [
          {
            carnationCount: 3,
            displayName: '아빠',
            memberId: 12,
            previousWeekWinner: true,
            rank: 1,
          },
        ],
        weekEnd: '2026-08-02',
        weekStart: '2026-07-27',
      }),
    );
    const gateway = createCarnationGateway({client});

    await expect(gateway.loadWeeklyRanking('group/1')).resolves.toEqual({
      rankings: [
        {
          carnationCount: 3,
          displayName: '아빠',
          memberId: '12',
          previousWeekWinner: true,
        },
      ],
      weekEnd: '2026-08-02',
      weekStart: '2026-07-27',
    });
    expect(client.get).toHaveBeenCalledWith('/groups/group%2F1/grass');
  });

  it('지정한 월요일-일요일 범위를 query로 전달한다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({rankings: [], weekEnd: '2026-08-02', weekStart: '2026-07-27'}),
    );
    const gateway = createCarnationGateway({client});

    await gateway.loadWeeklyRanking('group-1', '2026-07-27', '2026-08-02');

    expect(client.get).toHaveBeenCalledWith(
      '/groups/group-1/grass?startDate=2026-07-27&endDate=2026-08-02',
    );
  });

  it('카네이션 날짜 조회는 구성원과 날짜 범위를 함께 전달한다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({
        earnedDates: ['2026-07-27', '2026-07-30'],
        endDate: '2026-08-02',
        memberId: 12,
        startDate: '2026-07-27',
      }),
    );
    const gateway = createCarnationGateway({client});

    await expect(
      gateway.loadMemberCarnations(
        'group/1',
        '12',
        '2026-07-27',
        '2026-08-02',
      ),
    ).resolves.toEqual({
      earnedDates: ['2026-07-27', '2026-07-30'],
      endDate: '2026-08-02',
      memberId: '12',
      startDate: '2026-07-27',
    });
    expect(client.get).toHaveBeenCalledWith(
      '/groups/group%2F1/members/12/carnations?startDate=2026-07-27&endDate=2026-08-02',
    );
  });

  it('주간 범위가 계약과 다르면 서버 호출 전에 거부한다', async () => {
    const client = createClient();
    const gateway = createCarnationGateway({client});

    await expect(
      gateway.loadWeeklyRanking('group-1', '2026-07-28', '2026-08-03'),
    ).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
    expect(client.get).not.toHaveBeenCalled();
  });

  it('응답 날짜가 실제 주간 범위와 다르면 거부한다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({rankings: [], weekEnd: '2026-08-01', weekStart: '2026-07-27'}),
    );
    const gateway = createCarnationGateway({client});

    await expect(gateway.loadWeeklyRanking('group-1')).rejects.toMatchObject<
      Partial<ApiError>
    >({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });

  it('카네이션 응답의 구성원과 요청 ID가 다르면 거부한다', async () => {
    const client = createClient();
    client.get.mockResolvedValueOnce(
      success({
        earnedDates: [],
        endDate: '2026-08-02',
        memberId: 99,
        startDate: '2026-07-27',
      }),
    );
    const gateway = createCarnationGateway({client});

    await expect(
      gateway.loadMemberCarnations('group-1', '12', '2026-07-27', '2026-08-02'),
    ).rejects.toMatchObject<Partial<ApiError>>({
      code: 'INVALID_API_RESPONSE',
      kind: 'invalidResponse',
    });
  });
});
