// auth 도메인의 재사용 가능한 공개 진입점.
// 생년월일 스크롤 휠 선택기는 회원가입과 프로필 편집에서 함께 사용한다.
export {DatePickerSheet} from './components/DatePickerSheet';
// 인라인 검증 문구와 이름 길이 규칙은 회원가입과 프로필 편집이 같은 표시를 써야 한다.
export {ValidationMessage} from './components/ValidationMessage';
export {isValidName, SIGNUP_LIMITS} from './validation';
export {
  createInterestGateway,
  familyInterestGateway,
  getInterestErrorMessage,
} from './api/interestApi';
export type {
  InterestGateway,
  InterestGatewayOptions,
  MemberInterests,
} from './api/interestApi';
// 관심사 선택 화면은 온보딩과 피보호자 마이페이지(관심사 설정)에서 함께 사용한다.
export {InterestSelectionScreen} from './screens/InterestSelectionScreen';
export type {
  InterestSavedContent,
  InterestSelectionScreenProps,
} from './screens/InterestSelectionScreen';
