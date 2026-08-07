# 앱 전역 시스템 뒤로 가기 공통 규칙 규정

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-04
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/UI_AND_NAVIGATION.md`
- 관련 작업: S15P11B104-270
- 관련 제안: `CHG-S15P11B104-272-signup-complete-back-navigation.md`,
  `CHG-S15P11B104-369-sub-screen-back-destination.md`

## 기존 내용

- `docs/specs/UI_AND_NAVIGATION.md`는 "주요 진입 경로"와 "역할별 하단 탭"에서
  화면에 도달하는 경로만 규정하고, Android 시스템(하드웨어) 뒤로 가기를 눌렀을
  때의 결과는 규정하지 않는다.
- 화면별 뒤로 가기 결과는 일부만 존재한다. "그룹이 없는 상태"의 "B-3에서 뒤로
  가면 인증 상태를 유지한 A-10 안내 화면으로 돌아가며"와, "피보호자 관심사
  설정"의 "저장 전 `뒤로 가기`와 `건너뛰기`는 변경 내용을 저장하지 않고 J-1로
  돌아간다"가 그 전부다.
- `docs/specs/domains/ACCOUNT_AND_PROFILE.md`의 "확정된 동작" 6번과 인수 조건에
  관심사 조회 실패 시 `뒤로 가기`를 제공한다는 규정이 있으나, 화면 내 버튼과
  시스템 뒤로 가기를 구분하지 않는다.
- 그 밖의 도메인 스펙(`GROUPS_AND_MEMBERSHIP`, `FEED_AND_MEDIA`, `CALENDAR`,
  `REPORTS`, `NOTIFICATIONS`, `AI_CALL`, `COMMON`)과 `contracts/`에는 뒤로 가기
  규정이 없다.
- 결과적으로 시스템 뒤로 가기의 목표 동작을 판정할 공식 기준이 없어 화면마다
  개별 판단해 왔다.

## 제안 내용

`docs/specs/UI_AND_NAVIGATION.md`에 시스템 뒤로 가기 공통 규칙을 추가한다.

1. 하단 탭 루트에서 시스템 뒤로 가기를 누르면 피드 탭으로 돌아간다. 피드 탭
   루트에서만 앱을 종료한다. 이 규칙은 **탭 루트에만** 적용한다. 어느 탭도
   소유하지 않는 하위 화면(알림, 게시글 보관함, 가입 승인 대기)과 그 위에 쌓인
   화면은 진입 지점으로 돌아가며, 그 규칙은
   `CHG-S15P11B104-369-sub-screen-back-destination.md`에서 정한다.
2. 화면 내부에 되돌릴 상태(하위 전체화면, 인라인 편집, 열린 목록)가 있으면 그
   상태를 먼저 한 단계 되돌리고, 되돌릴 상태가 없을 때 1번을 적용한다.
3. 저장·삭제·처리가 진행 중인 동안에는 시스템 뒤로 가기를 소비하고 현재 화면을
   유지한다.
4. 화면 내 뒤로 가기 버튼과 시스템 뒤로 가기의 이동 결과를 일치시킨다.

`CHG-S15P11B104-272`가 이 작업에 넘긴 질문에 대해서는 다음을 함께 제안한다.

- "종료 지점 화면은 시스템 뒤로 가기를 소비한다"를 앱 전역 공통 규칙으로 세우지
  않고, 회원가입 완료 안내 단계에만 한정한다.
- 근거는 1번이다. 홈에 해당하는 피드 탭 루트에서까지 뒤로 가기를 소비하면
  사용자가 뒤로 가기로 앱을 벗어날 수 없어 Android 관례에 어긋난다.

## 변경 근거

- QA에서 시스템 뒤로 가기가 이전 화면 대신 앱을 종료시키는 결함이 확인되었다.
  `docs/qa/2026-08-02-release-code-qa.md`의 QA-030이며, 재현 로그에서 뒤로 가기
  이후 `topResumedActivity`가 런처로 바뀌고 crash 버퍼는 비어 있어 crash가 아닌
  잘못된 화면 이동으로 판정되었다.
- 원인은 화면 이력 자료구조의 부재다. `frontend/src/app-shell/AppShell.tsx`가
  `activeRoute` 단일 상태로 화면을 전환하므로 뒤로 가기 목적지를 화면마다
  `frontend/src/shared/hooks/useHardwareBack.ts`로 개별 등록해야 한다.
- 등록이 없으면 React Native가 `BackHandler.exitApp()`을 호출한다.
  `node_modules/react-native/Libraries/Utilities/BackHandler.android.js`가
  리스너를 역순으로 호출하고 아무도 `true`를 반환하지 않으면 종료시킨다. 즉
  등록 누락과 "앱을 종료한다"는 결과가 같다.
- 수정 전 `AppShell`은 `archive`, `notifications`, `profile` 세 라우트만 열거해
  뒤로 가기를 처리했고, 하단 탭인 `calendar`, `report`, `aiCall`, `groupInfo`는
  목록에 없어 앱이 종료되었다.
- 아래에서 `notifications`와 `archive`를 하단 탭 라우트와 같은 층으로 적은 것은
  작성 시점(2026-08-04) 구현을 따른 것이다. 당시 셸이 단일 `activeRoute` 상태로
  탭과 이 둘을 같은 층에서 다뤘다. S15P11B104-367 이후 두 화면은 피드 탭 스택의
  하위 화면이므로 더 이상 탭 라우트가 아니다. 이 제안의 규칙 자체는 그 전환
  이후에도 그대로 성립한다 — 목적지가 아니라 소속 층만 달라졌다.
- 1번의 목적지를 피드 탭으로 정한 근거는 React Navigation의 하단 탭 기본값
  `backBehavior: 'firstRoute'`다. 널리 쓰이는 Android 관례이며, 이미 이 앱이
  `archive`·`notifications`·`profile`에서 사용하던 정책과 같다.
- 2번의 필요성은 RN `Modal`과 인라인 팝업의 차이에서 확인되었다. `Modal`은
  네이티브 Dialog가 뒤로 가기를 소비하지만(`ReactAndroid`의
  `ReactModalHostView.kt`), `View`로 그린 인라인 편집은 소비되지 않아 되돌릴
  단계가 없으면 편집값이 사라진다. 그룹정보의 호칭 인라인 편집과 프로필 편집의
  성별 드롭다운이 해당했다.
- 3번은 기존 구현에서 이미 쓰던 관례를 명문화한 것이다.
  `ProfileEditScreen`의 `isSaving`, `CalendarEventFormScreen`의 `saving`,
  `CalendarEventDetailModal`의 `deleting`이 같은 방식으로 동작한다.
- 구현과 회귀 테스트는 커밋 `d0b348f`, `30ff191`에서 완료했다. 검증은
  `frontend/src/app-shell/AppShell.test.tsx`,
  `frontend/src/features/group-info/screens/GroupInfoScreen.test.tsx`,
  `frontend/src/features/profile/screens/ProfileEditScreen.test.tsx`에 있다.
  `AppShell` 수정을 되돌리면 탭 4개의 테스트가 실패하는 것을 확인했다.

## 확인된 영향

- 영향 도메인: 전 도메인의 화면 전환. 특정 도메인 규칙이 아니라 공통 규칙이다.
- 영향 계약: `UI_AND_NAVIGATION` 화면 전이 계약. API·데이터 계약 변경은 없다.
- 영향 화면: 하단 탭 라우트(`feed`, `calendar`, `report`, `aiCall`, `groupInfo`,
  `profile`)와 하위 화면(`notifications`, `archive`), 그리고 그룹정보 호칭 인라인
  편집, 프로필 편집 성별 드롭다운. 작성 시점에는 하위 화면 둘도 탭 라우트로
  구현돼 있어 "탭 8개"로 적었다(위 변경 근거 참고).
- 검증 범위: Jest(`npm test`), TypeScript 타입 검사, ESLint, 에뮬레이터 수동
  확인. 역할별로 노출 탭이 달라 보호자·피보호자 두 계정으로 확인한다.
- 커버리지 갱신 후보: `docs/specs/COVERAGE.md`의 `REQ-009 역할별 화면 및 하단
  내비게이션` 행 또는 `IA 00 공통 기준` 행. 확인 필요.

## 확인이 필요한 질문

- 2번의 "되돌릴 상태"를 어디까지로 볼지 확인 필요. 이번 작업에서는 앱이
  종료되거나 편집값이 사라지는 지점만 처리했고, 다음 네 곳은 되돌릴 단계 없이
  상위 화면으로 이동한다. 같은 공통 규칙으로 묶을지 화면별로 둘지 결정이 필요하다.
  - 리포트 화면의 선택 날짜(`ReportScreen`의 `selectedReportDate`)
  - 보관함의 날짜·구성원 필터(`ArchiveScreen`의 `selectedDateKey`,
    `selectedMemberId`)
  - 게시글 상세의 댓글 수정 입력(`PostDetailScreen`의 `editingComment`)
  - 일정 편집 폼의 작성 중 내용(`CalendarEventFormScreen`의 `draft`)
- 미저장 변경이 있을 때 확인창을 띄우는 기준 확인 필요. 현재 게시글 작성
  화면만 `Alert` 확인을 제공하고 일정 편집은 확인 없이 폐기한다.
  `UI_AND_NAVIGATION`의 `미결정 사항`에 있는 `REQ-031` 결정과 함께 정해야 한다.
- 이 제안과 `CHG-S15P11B104-272`는 함께 승인해야 한다. 272의
  `확인이 필요한 질문`에 대한 답을 이 제안의 `제안 내용`에 담았으므로, 한쪽만
  승인하면 회원가입 완료 단계의 예외 처리 근거가 불완전해진다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
