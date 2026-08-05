import {act, create} from 'react-test-renderer';

import AiCallView, {Commands} from '../native/AiCallViewNativeComponent';
import {AiCallScreen} from './AiCallScreen';

jest.mock('../native/AiCallViewNativeComponent', () => ({
  __esModule: true,
  Commands: {
    completeAccessTokenRefresh: jest.fn(),
  },
  default: 'AiCallView',
}));

const mockCompleteAccessTokenRefresh =
  Commands.completeAccessTokenRefresh as jest.Mock;

const CURRENT_GROUP = {
  id: 'group-1',
  name: '우리 가족',
  role: 'careReceiver' as const,
};

const CREATE_OPTIONS = {
  createNodeMock: () => ({nativeView: true}),
};

describe('AiCallScreen', () => {
  beforeEach(() => {
    mockCompleteAccessTokenRefresh.mockReset();
  });

  it('통화 상태에 맞춰 앱 셸의 전체 화면 상태를 변경한다', () => {
    const onFullscreenChange = jest.fn();
    const onHeaderVisibilityChange = jest.fn();
    const onCallResult = jest.fn();

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          currentGroup={CURRENT_GROUP}
          accessToken="access-token"
          onCallResult={onCallResult}
          onFullscreenChange={onFullscreenChange}
          onHeaderVisibilityChange={onHeaderVisibilityChange}
          role="careReceiver"
        />,
        CREATE_OPTIONS,
      );
    });

    expect(onHeaderVisibilityChange).toHaveBeenCalledWith(false);

    const nativeView = renderer!.root.findByType(AiCallView);
    expect(nativeView.props.accessToken).toBe('access-token');
    expect(nativeView.props.groupId).toBe('group-1');
    act(() => {
      nativeView.props.onFullscreenChange({
        nativeEvent: {isFullscreen: true},
      });
    });

    expect(onFullscreenChange).toHaveBeenCalledWith(true);

    act(() => {
      nativeView.props.onCallResult({
        nativeEvent: {status: 'COMPLETED'},
      });
    });
    expect(onCallResult).toHaveBeenCalledWith('COMPLETED');
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);

    act(() => {
      renderer!.unmount();
    });
    expect(onHeaderVisibilityChange).toHaveBeenLastCalledWith(true);
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
  });

  it('네이티브 요청을 공통 인증 세션으로 재발급하고 같은 ID로 완료한다', async () => {
    const authSession = {
      getAccessToken: jest.fn().mockReturnValue('old-access'),
      getRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      refreshAccessToken: jest.fn().mockResolvedValue('new-access'),
    };
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          authSession={authSession}
          currentGroup={CURRENT_GROUP}
          role="careReceiver"
        />,
        CREATE_OPTIONS,
      );
    });

    expect(authSession.refreshAccessToken).not.toHaveBeenCalled();
    const nativeView = renderer!.root.findByType(AiCallView);
    await act(async () => {
      nativeView.props.onAccessTokenRefreshRequested({
        nativeEvent: {requestId: 'request-1'},
      });
      await Promise.resolve();
    });

    expect(authSession.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(mockCompleteAccessTokenRefresh).toHaveBeenCalledWith(
      expect.any(Object),
      'request-1',
      'new-access',
      '',
    );
    expect(renderer!.root.findByType(AiCallView).props.accessToken).toBe(
      'new-access',
    );
  });

  it('인증 세션이 없으면 기존 토큰으로 우회하지 않는다', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          accessToken="legacy-access"
          currentGroup={CURRENT_GROUP}
          role="careReceiver"
        />,
        CREATE_OPTIONS,
      );
    });

    const nativeView = renderer!.root.findByType(AiCallView);
    act(() => {
      nativeView.props.onAccessTokenRefreshRequested({
        nativeEvent: {requestId: 'request-2'},
      });
    });

    expect(mockCompleteAccessTokenRefresh).toHaveBeenCalledWith(
      expect.any(Object),
      'request-2',
      '',
      'AUTH_SESSION_UNAVAILABLE',
    );
  });

  it('재발급 실패를 안정적인 오류 코드로 네이티브에 반환한다', async () => {
    const authSession = {
      getAccessToken: jest.fn().mockReturnValue('old-access'),
      getRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      refreshAccessToken: jest.fn().mockRejectedValue(new Error('failed')),
    };
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          authSession={authSession}
          currentGroup={CURRENT_GROUP}
          role="careReceiver"
        />,
        CREATE_OPTIONS,
      );
    });

    const nativeView = renderer!.root.findByType(AiCallView);
    await act(async () => {
      nativeView.props.onAccessTokenRefreshRequested({
        nativeEvent: {requestId: 'request-3'},
      });
      await Promise.resolve();
    });

    expect(mockCompleteAccessTokenRefresh).toHaveBeenCalledWith(
      expect.any(Object),
      'request-3',
      '',
      'AUTH_REFRESH_FAILED',
    );
  });

  it('화면 해제 뒤 도착한 재발급 결과는 네이티브에 보내지 않는다', async () => {
    let resolveRefresh!: (accessToken: string) => void;
    const authSession = {
      getAccessToken: jest.fn().mockReturnValue('old-access'),
      getRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      refreshAccessToken: jest.fn(
        () =>
          new Promise<string>(resolve => {
            resolveRefresh = resolve;
          }),
      ),
    };
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          authSession={authSession}
          currentGroup={CURRENT_GROUP}
          role="careReceiver"
        />,
        CREATE_OPTIONS,
      );
    });

    const nativeView = renderer!.root.findByType(AiCallView);
    act(() => {
      nativeView.props.onAccessTokenRefreshRequested({
        nativeEvent: {requestId: 'request-4'},
      });
      renderer!.unmount();
    });
    await act(async () => {
      resolveRefresh('late-access');
      await Promise.resolve();
    });

    expect(mockCompleteAccessTokenRefresh).not.toHaveBeenCalled();
  });

  it('updates the native access token when the authenticated user changes', () => {
    let currentAccessToken = 'first-user-access';
    const authSession = {
      getAccessToken: jest.fn(() => currentAccessToken),
      getRefreshToken: jest.fn().mockReturnValue('refresh-token'),
      refreshAccessToken: jest.fn(),
    };
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          authSession={authSession}
          currentGroup={CURRENT_GROUP}
          currentUserId={1}
          role="careReceiver"
        />,
        CREATE_OPTIONS,
      );
    });

    expect(renderer!.root.findByType(AiCallView).props.accessToken).toBe(
      'first-user-access',
    );

    currentAccessToken = 'second-user-access';
    act(() => {
      renderer!.update(
        <AiCallScreen
          authSession={authSession}
          currentGroup={CURRENT_GROUP}
          currentUserId={2}
          role="careReceiver"
        />,
      );
    });

    expect(renderer!.root.findByType(AiCallView).props.accessToken).toBe(
      'second-user-access',
    );
  });
});
