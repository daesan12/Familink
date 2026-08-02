import {useEffect, useRef} from 'react';
import {BackHandler} from 'react-native';

export function useHardwareBack(
  onBack: () => boolean,
  enabled = true,
): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => onBackRef.current(),
    );

    return () => subscription.remove();
  }, [enabled]);
}
