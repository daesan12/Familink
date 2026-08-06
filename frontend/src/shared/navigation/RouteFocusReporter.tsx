import {useEffect} from 'react';
import {useIsFocused} from '@react-navigation/native';

// 라우트 포커스를 셸 신호(풀스크린 등)용 미러로 보고한다. 반드시 화면 함수
// 밖에서 참조해야 한다 — 렌더 본문 안에서 정의하면 매 렌더 리마운트된다.
// FeedScreen의 로컬 구현과 동형이며, 프로필 두 화면(보호자·피보호자)이
// 공유한다(feed 쪽 수렴은 별도 과제로 두고 이번 변경은 feed 무접촉).
export function RouteFocusReporter({
  onFocusChange,
}: {
  onFocusChange: (isFocused: boolean) => void;
}) {
  const isFocused = useIsFocused();

  useEffect(() => {
    onFocusChange(isFocused);
    return () => onFocusChange(false);
  }, [isFocused, onFocusChange]);

  return null;
}
