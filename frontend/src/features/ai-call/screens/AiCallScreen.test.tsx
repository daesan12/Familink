import {act, create} from 'react-test-renderer';

import AiCallView from '../native/AiCallViewNativeComponent';
import {AiCallScreen} from './AiCallScreen';

jest.mock('../native/AiCallViewNativeComponent', () => 'AiCallView');

describe('AiCallScreen', () => {
  it('통화 상태에 맞춰 앱 셸의 전체 화면 상태를 변경한다', () => {
    const onFullscreenChange = jest.fn();
    const onHeaderVisibilityChange = jest.fn();
    const onCallResult = jest.fn();

    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <AiCallScreen
          currentGroup={{
            id: 'group-1',
            name: '우리 가족',
            role: 'careReceiver',
          }}
          accessToken="access-token"
          onCallResult={onCallResult}
          onFullscreenChange={onFullscreenChange}
          onHeaderVisibilityChange={onHeaderVisibilityChange}
          role="careReceiver"
        />,
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
    expect(onFullscreenChange).toHaveBeenLastCalledWith(true);

    act(() => {
      renderer!.unmount();
    });
    expect(onHeaderVisibilityChange).toHaveBeenLastCalledWith(true);
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
  });
});
