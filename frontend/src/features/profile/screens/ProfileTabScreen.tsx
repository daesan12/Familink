import type {AppScreenProps} from '../../../app-shell';
import {CareReceiverMyPageScreen} from './CareReceiverMyPageScreen';
import {MyPageScreen} from './MyPageScreen';

// 마이페이지(프로필) 탭 진입점. 현재 그룹에서의 역할에 따라 화면을 고른다.
// 보호자는 효자 도장(I-1), 피보호자는 관심사 설정(J-1)을 본다.
export function ProfileTabScreen(props: AppScreenProps) {
  if (props.role === 'careReceiver') {
    return <CareReceiverMyPageScreen {...props} />;
  }
  return <MyPageScreen {...props} />;
}
