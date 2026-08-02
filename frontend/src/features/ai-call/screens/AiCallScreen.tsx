import {useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import AiCallView from '../native/AiCallViewNativeComponent';

const SELECTION_BACKGROUND = '#FFFFFF';
const CALL_BACKGROUND = '#32313D';

export function AiCallScreen({
  apiBaseUrl,
  authSession,
  accessToken,
  currentGroup,
  onCallResult,
  onFullscreenChange,
  onHeaderVisibilityChange,
}: AppScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [resolvedAccessToken, setResolvedAccessToken] = useState(
    () =>
      authSession === undefined
        ? accessToken ?? null
        : authSession.getAccessToken(),
  );

  useEffect(() => {
    let active = true;
    const syncAccessToken = () => {
      const latest =
        authSession === undefined
          ? accessToken ?? null
          : authSession.getAccessToken();
      setResolvedAccessToken(previous =>
        previous === latest ? previous : latest,
      );
    };

    syncAccessToken();
    if (authSession !== undefined) {
      void authSession
        .refreshAccessToken()
        .then(latest => {
          if (active) {
            setResolvedAccessToken(latest);
          }
        })
        .catch(() => {
          if (active) {
            syncAccessToken();
          }
        });
    }
    const refreshTimer =
      authSession === undefined ? undefined : setInterval(syncAccessToken, 1000);

    return () => {
      active = false;
      if (refreshTimer !== undefined) {
        clearInterval(refreshTimer);
      }
    };
  }, [accessToken, authSession]);

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

  return (
    <View style={styles.root}>
      <StatusBar
        backgroundColor={
          isFullscreen ? CALL_BACKGROUND : SELECTION_BACKGROUND
        }
        barStyle={isFullscreen ? 'light-content' : 'dark-content'}
      />
      <AiCallView
        apiBaseUrl={apiBaseUrl ?? null}
        accessToken={resolvedAccessToken}
        groupId={currentGroup.id}
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
