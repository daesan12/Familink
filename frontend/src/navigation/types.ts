// 루트 스택의 화면 이름 집합. App.tsx의 route useState가 단일 소스이며,
// 각 route 값이 곧 Stack.Screen name이다 (S15P11B104-319).
export type RootRoute =
  | 'welcome'
  | 'signup'
  | 'signedInWelcome'
  | 'groupOnboarding'
  | 'interestSetup'
  | 'appShell';

// route 값 = Screen name 1:1 대응, 전 화면 params 없음.
export type RootStackParamList = Record<RootRoute, undefined>;
