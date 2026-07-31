import {useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';

import type {AppScreenProps} from '../../../app-shell';
import AiCallView from '../native/AiCallViewNativeComponent';

const SELECTION_BACKGROUND = '#FFFFFF';
const CALL_BACKGROUND = '#32313D';

export function AiCallScreen({
  accessToken,
  currentGroup,
  onCallResult,
  onFullscreenChange,
  onHeaderVisibilityChange,
}: AppScreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        accessToken={accessToken ?? null}
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
