import {useEffect, useState} from 'react';
import {Keyboard} from 'react-native';

/**
 * 키보드가 화면에 떠 있는지 알려준다.
 * 키보드가 올라오면 화면에서 쓸 수 있는 높이가 크게 줄기 때문에, 그때만
 * 여백이나 최소 높이를 놓아주려는 화면에서 사용한다.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
