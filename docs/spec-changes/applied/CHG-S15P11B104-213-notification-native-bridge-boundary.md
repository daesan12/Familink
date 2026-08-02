# 푸시 토큰 발급용 Kotlin 네이티브 브리지 경계 확장

- 상태: 반영 완료
- 제안자: rudgh8182
- 작성일: 2026-08-01
- 차단 변경: 예
- 영향 스펙·계약: `COMMON`(서비스와 데이터 소유권), `NOTIFICATIONS`(구현 규칙)
- 관련 작업: S15P11B104-213, S15P11B104-162(선행), S15P11B104-124(서버 측)

## 기존 내용

`docs/specs/COMMON.md` 83~85행 「서비스와 데이터 소유권」:

> 모바일 앱의 AI 전화 화면과 통화 엔진만 Android Kotlin 네이티브
> 모듈로 구현한다. AI 전화를 제외한 모바일 화면과 기능은 React Native로
> 구현하며, React Native와 Kotlin의 브리지는 AI 전화 경계에서만 사용한다.

같은 취지가 다음 문서에도 반복된다.

- `docs/specs/domains/AI_CALL.md` 11행 「핵심 규칙」
- `docs/conventions/react-native.md` 75~77행 「import와 모듈 경계」
- `docs/development-contracts.md` 27행
- `docs/design-contracts.md` 19행

한편 `docs/specs/domains/NOTIFICATIONS.md` 140~143행 「구현 규칙」은 다음을
확정 동작으로 규정한다.

> 로그인 성공 또는 인증 세션 복원 후 OS 알림 권한과 토큰이 있으면
> 등록한다. 인증 상태에서 FCM 토큰이 갱신되면 다시 등록하고, 인증 전
> 토큰은 로컬에 보관했다가 인증 후 등록한다.

## 제안 내용

`COMMON.md`의 모바일 기술 경계를 다음과 같이 조정한다.

1. AI 전화 경계에 더해, **Android 푸시 등록 토큰 확보를 위한 Kotlin 네이티브
   모듈 하나를 추가로 허용**한다.
2. 이 모듈의 허용 범위는 **FCM 등록 토큰의 발급과 갱신 전달로만 한정**한다.
   알림 목록·읽음·설정 화면과 그 상태 관리는 React Native 구현을 유지한다.
3. 토큰 갱신을 실시간으로 반영하기 위해 **`FirebaseMessagingService`
   구현과 Manifest 서비스 선언을 함께 허용**한다. 이 서비스의 역할은
   `onNewToken`으로 받은 토큰을 React Native에 전달하는 것으로 한정하며,
   메시지 수신 표시는 담당하지 않는다.
4. 위 두 네이티브 구성요소는 **서비스 API를 직접 호출하지 않는다.** 확보한
   토큰을 React Native 계층에 전달하고, `API-NOTIFICATIONS-001`과
   `API-NOTIFICATIONS-008` 호출은 React Native가 수행한다.
5. React Native 컨텍스트가 없는 상태에서 `onNewToken`이 발생하면 등록을
   네이티브에서 수행하지 않는다. 다음 로그인 또는 세션 복원 시
   React Native가 토큰을 재조회해 등록하는 기존 경로로 수렴한다.
6. 허용 경계는 **AI 전화와 푸시 등록 토큰 두 가지뿐**이다. 그 외 기능에
   새 브리지를 추가하려면 다시 스펙 변경 절차를 거친다.

Android 클라이언트 설정 파일의 취급 기준을 다음과 같이 함께 정한다.

7. **`google-services.json`은 저장소에 커밋한다.** 이 파일은 프로젝트·앱
   식별자와 Android API 키를 담은 비밀이 아닌 설정 파일이며, 서버의 Firebase
   service account JSON(`FIREBASE_CREDENTIALS_FILE`)과 달리 저장소 밖 보관
   대상이 아니다. 푸시 발송 권한은 이 파일에 포함되지 않는다.
8. Android API 키에는 Google Cloud Console에서 **Firebase 관련 API로 제한을
   적용**하고, **Generative Language API 접근은 허용하지 않는다.** 게시글
   분석용 `GMS_API_KEY`는 기존대로 서버에서만 보관한다(`COMMON.md` 93~95행).

## 변경 근거

**현행 스펙만으로는 확정 동작을 구현할 수 없다.** FCM 등록 토큰은 Android
Firebase SDK(`FirebaseMessaging`)를 통해서만 얻을 수 있고, 순수 React Native
코드로는 획득 경로가 없다. 따라서 `NOTIFICATIONS.md` 140~143행의 확정 동작과
`COMMON.md` 83~85행의 기술 경계가 현재 서로 충돌한다.

**코드가 이미 이 경계를 전제하고 있다.**
`frontend/src/features/notifications/deviceTokenProvider.ts` 13행은
`NativeModules.FamilinkNotifications`를 조회하지만 대응하는 Kotlin 구현이
없어 항상 `undefined`다. 그 결과 `getToken()`이 `null`을 반환하고
(`deviceTokenProvider.ts` 47~49행), 토큰 등록이 한 번도 일어나지 않는다.
`frontend/App.tsx` 502~628행의 등록·비활성화 수명주기는 완성되어 있으나
입력이 비어 있어 동작하지 않는 상태다.

**대안을 검토한 뒤 팀이 Kotlin 직접 구현으로 결정했다.**
`@react-native-firebase/messaging`을 쓰면 자체 브리지를 만들지 않아도 되지만,
v26부터 전 패키지가 Codegen TurboModule로 전환되어 New Architecture를
요구하며(프로젝트는 `newArchEnabled=true`로 충족), **RN 0.86.2 / React 19.2.3에
대한 지원 범위는 공식 문서에서 확인되지 않았다.** 또한 이 방식도
`google-services` 플러그인과 `google-services.json`을 동일하게 요구하므로
Gradle 작업량은 줄지 않는다. 라이브러리 비호환은 통제할 수 없는 반면 문서
경계는 팀 합의로 조정 가능하다는 판단에 따라 Kotlin 직접 구현으로 결정했다.

**모듈 범위를 토큰으로 좁힐 수 있다.**
`backend/.../push/FirebasePushSender.java` 20~27행이 `setNotification(...)`
페이로드를 전송하므로, 백그라운드·종료 상태의 알림 표시는 Android 시스템이
처리한다. 네이티브 모듈이 알림 채널 생성이나 알림 빌드를 담당할 필요가 없다.

**토큰 갱신 실시간 반영을 포함하기로 결정했다.** 등록은 현재 세션 복원
(`App.tsx` 734행)과 로그인(`App.tsx` 770행) 두 시점에만 일어난다. 앱이 살아
있는 동안 FCM이 토큰을 회전시키면 서버는 무효 토큰을 계속 사용하고, 첫 전송
실패에서 `NotificationPushService` 70~71행이 해당 토큰을 비활성화한다. 그
결과 활성 토큰이 없는 상태가 되어 **다음 콜드 스타트까지 모든 푸시가 조용히
누락된다.** 사용자가 누락 사실을 인지할 방법이 없으므로 이 구간을 닫기로
했다. `subscribeTokenRefresh`는 `types.ts` 76행에서 선택 항목이고 `App.tsx`
620행이 미구현 시 건너뛰므로, 구현을 추가해도 기존 수명주기 코드는 변경되지
않는다.

**`google-services.json`은 비밀이 아니다.** Firebase 공식 문서는 이 파일을
"unique, non-secret identifiers"로 규정하고, Firebase API 키는 인가가 아니라
요청 라우팅용 식별자이므로 체크인된 설정 파일에 포함해도 안전하다고 안내한다
(https://firebase.google.com/docs/projects/api-keys,
https://firebase.google.com/docs/android/setup). 접근 제어는 Security Rules와
App Check가 담당한다. 이 파일은 APK에 그대로 포함되어 배포되므로 저장소에서
제외해도 비공개가 되지 않으며, 제외할 경우 팀원과 CI가 빌드할 때마다 비밀이
아닌 파일을 별도로 배포해야 한다. 같은 문서가 API 키에 Firebase 관련 API
제한을 적용하고 Generative Language API 접근을 배제할 것을 권고한다.

## 확인된 영향

- 영향 도메인: `NOTIFICATIONS`. `AI_CALL`은 기존 경계를 그대로 유지한다.
- 영향 계약: 없음. `API-NOTIFICATIONS-001`·`API-NOTIFICATIONS-008`의 요청·응답
  형식과 `device_tokens` 데이터 계약은 변경하지 않는다. `deviceType`은
  `ANDROID` 단일값을 유지한다.
- 영향 화면: 없음. 알림 목록·설정 화면은 React Native 구현을 유지한다.
- 검증 범위: Kotlin 모듈 JVM 테스트, `deviceTokenProvider` 단위 테스트
  (`getToken`과 `subscribeTokenRefresh` 포함), 실기기에서 알림 권한·토큰
  발급·갱신·등록·비활성화 end-to-end 확인. 갱신은 앱 실행 중 토큰 회전을
  유도해 `onNewToken` 경로로 재등록되는지 확인한다.
- 네이티브 표면: `FamilinkNotifications` 모듈과 `FirebaseMessagingService`
  하위 클래스 하나, Manifest 서비스 선언 하나가 추가된다. 알림 채널 생성과
  알림 표시 코드는 추가하지 않는다.
- 반영 대상 문서: `docs/specs/COMMON.md`(모바일 기술 경계와 설정 파일 취급),
  `docs/conventions/react-native.md`, `docs/development-contracts.md`,
  `docs/design-contracts.md`.
  `docs/specs/domains/AI_CALL.md` 11행은 AI 전화 자체의 규칙이므로
  변경 필요 여부를 반영 시점에 판단한다.
- 저장소 설정: `google-services.json`을 커밋하므로 `.gitignore`에 추가하지
  않는다. 현재도 포함되어 있지 않아 별도 변경은 필요 없다.

## 결정 및 반영

- 결정: 승인(전체). 제안 내용 1~8번 전부 반영.
- 결정자: rudgh8182
- 결정일: 2026-08-01
- 반영 문서:
  - `docs/specs/COMMON.md` — 브리지 경계 두 곳으로 조정, 푸시 경계의 역할과
    API 비호출 제약 추가, `google-services.json` 취급 기준 추가
  - `docs/specs/COVERAGE.md` — 「기술 스택 / 아키텍처 명확히 결정」 행의 비고를
    "AI 통화 화면과 푸시 등록 토큰만 Kotlin"으로 갱신
  - `docs/specs/INDEX.md` — NOTIFICATIONS 행의 관련 코드 영역에 푸시 등록 토큰
    전용 Kotlin 모듈 추가
  - `docs/specs/UI_AND_NAVIGATION.md` — 「AI 작업 컨텍스트」 핵심 규칙이 같은
    경계를 중복 서술해 `COMMON.md`와 모순되므로 화면 없는 푸시 구성요소가
    예외임을 명시. 제안의 반영 대상 목록에는 없었으나 반영 후 검증에서
    발견한 모순을 해소하기 위해 최소 범위로 수정했다. 화면 흐름과 IA는
    변경하지 않았다.
  - `docs/conventions/react-native.md` — 네이티브 모듈 허용 경계 갱신
  - `docs/development-contracts.md` — 서비스·권한 경계에 푸시 예외 추가
  - `docs/design-contracts.md` — 모바일 구현 경계에 푸시 예외 추가
- 미반영 문서와 사유:
  - `docs/specs/domains/AI_CALL.md` 11행 — AI 전화 도메인 내부의 구현 범위를
    설명하는 문장이며 제품 전체 경계 규정이 아니므로 변경하지 않았다.
    제품 경계는 `COMMON.md`가 기준이다.
  - `docs/specs/domains/NOTIFICATIONS.md` — 확정 동작과 API·데이터 계약이
    변경되지 않았고 클라이언트 네이티브 경계는 `COMMON.md`가 규정하므로
    변경하지 않았다.
- 반영 커밋:
