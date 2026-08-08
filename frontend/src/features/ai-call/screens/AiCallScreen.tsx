import type {ElementRef} from 'react';
import {useEffect, useRef, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import AiCallView, {Commands} from '../native/AiCallViewNativeComponent';

const SELECTION_BACKGROUND = '#FFFFFF';
// 통화 화면 배경이 위쪽 연보라에서 아래쪽 흰색으로 내려가므로 상태바도 그 위쪽 색을
// 따라간다. 어두운 색을 그대로 두면 밝은 배경 위에 흰 시계·배터리가 겹쳐 보이지 않는다.
const CALL_BACKGROUND = '#F2F0FF';

export function AiCallScreen({
  apiBaseUrl,
  authSession,
  accessToken,
  currentGroup,
  currentUserId,
  onCallResult,
  onFullscreenChange,
  onHeaderVisibilityChange,
}: AppScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const aiCallViewRef = useRef<ElementRef<typeof AiCallView> | null>(null);
  const isMountedRef = useRef(true);
  const [resolvedAccessToken, setResolvedAccessToken] = useState(
    () =>
      authSession === undefined
        ? accessToken ?? null
        : authSession.getAccessToken(),
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const latest =
      authSession === undefined
        ? accessToken ?? null
        : authSession.getAccessToken();
    setResolvedAccessToken(previous =>
      previous === latest ? previous : latest,
    );
  }, [accessToken, authSession, currentUserId]);

  useEffect(() => {
    onHeaderVisibilityChange?.(false);

    return () => {
      onHeaderVisibilityChange?.(true);
      onFullscreenChange?.(false);
    };
  }, [onFullscreenChange, onHeaderVisibilityChange]);

  const handleFullscreenChange = (fullscreen: boolean) => {
    setIsFullscreen(fullscreen);
    onFullscreenChange?.(fullscreen);
  };

  const handleCallResult = (status: string) => {
    if (
      status === 'COMPLETED' ||
      status === 'CANCELLED' ||
      status === 'FAILED'
    ) {
      handleFullscreenChange(false);
      onCallResult?.(status);
    }
  };

  const completeAccessTokenRefresh = (
    requestId: string,
    nextAccessToken: string,
    errorCode: string,
  ) => {
    const nativeView = aiCallViewRef.current;
    if (!isMountedRef.current || nativeView === null) {
      return;
    }
    Commands.completeAccessTokenRefresh(
      nativeView,
      requestId,
      nextAccessToken,
      errorCode,
    );
  };

  const handleAccessTokenRefreshRequested = async (requestId: string) => {
    if (authSession === undefined) {
      completeAccessTokenRefresh(
        requestId,
        '',
        'AUTH_SESSION_UNAVAILABLE',
      );
      return;
    }

    try {
      const nextAccessToken = await authSession.refreshAccessToken();
      if (!isMountedRef.current) {
        return;
      }
      setResolvedAccessToken(nextAccessToken);
      completeAccessTokenRefresh(requestId, nextAccessToken, '');
    } catch {
      completeAccessTokenRefresh(requestId, '', 'AUTH_REFRESH_FAILED');
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar
        backgroundColor={
          isFullscreen ? CALL_BACKGROUND : SELECTION_BACKGROUND
        }
        barStyle="dark-content"
      />
      <AiCallView
        ref={aiCallViewRef}
        apiBaseUrl={apiBaseUrl ?? null}
        accessToken={resolvedAccessToken}
        groupId={currentGroup.id}
        onAccessTokenRefreshRequested={event => {
          handleAccessTokenRefreshRequested(event.nativeEvent.requestId);
        }}
        onCallResult={event => handleCallResult(event.nativeEvent.status)}
        onFullscreenChange={event =>
          handleFullscreenChange(event.nativeEvent.isFullscreen)
        }
        style={styles.nativeView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nativeView: {
    flex: 1,
  },
  root: {
    backgroundColor: SELECTION_BACKGROUND,
    flex: 1,
  },
});
