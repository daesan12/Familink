# 모바일 인증 세션 저장·복원·재발급 처리 확정

- 상태: 승인·반영 완료
- 제안자: Codex
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/COMMON.md`, `docs/specs/contracts/API.md`, `docs/specs/UI_AND_NAVIGATION.md`
- 관련 작업: `S15P11B104-141`, `S15P11B104-142` 및 Access Token이 필요한 모든 프런트엔드 API 연동 작업
- 관련 제안: [`CHG-S15P11B104-114-auth-token-storage-and-ttl.md`](./CHG-S15P11B104-114-auth-token-storage-and-ttl.md)

## 기존 내용

`docs/specs/COMMON.md`의 「인증과 요청 경계」와
`docs/specs/contracts/API.md`의 `API-AUTH-003`~`API-AUTH-005`는 다음 서버
계약을 확정한다.

- 보호 API는 Access Token을 사용한다.
- `POST /auth/reissue`는 body의 `refreshToken`을 현재 Redis 저장값과
  비교하여 새 Token Pair로 원자 회전한다.
- Access Token 기본 유효 기간은 30분, Refresh Token 기본 유효 기간은
  14일이며 사용자별 Refresh Token은 한 개만 활성 상태다.
- 재발급 성공 결과는 `tokenType`, `accessToken`,
  `accessTokenExpiresIn`, `refreshToken`이다.
- 재발급의 명시 오류는 `400 INVALID_REQUEST`,
  `401 INVALID_REFRESH_TOKEN`이다.

그러나 공식 스펙에는 다음 클라이언트 동작이 정의되어 있지 않다.

- Access Token과 Refresh Token을 Android 기기에 어떤 방식으로 저장하는지
- 앱 재실행 시 저장된 세션을 어떤 순서로 검증하고 복원하는지
- 보호 API 여러 건이 동시에 `401`을 반환할 때 재발급을 직렬화하는지
- 재발급 실패와 일시적 네트워크 실패를 어떻게 구분하는지
- 인증이 최종 무효화됐을 때 앱 상태를 어떻게 비로그인 상태로 전환하는지
- 서버 로그아웃 실패 시 로컬 인증 정보를 삭제하는지

기존
당시 pending이던 `CHG-S15P11B104-114-auth-token-storage-and-ttl.md`는
클라이언트 single-flight를 질문으로 남겼고, 2026-07-29 일부 승인에서 해당
항목을 승인 범위에서 제외했다. 따라서 그 pending 내용을 현재 구현 기준으로
사용할 수 없다.

현재 `frontend/src/shared/api/apiClient.ts`에는 Authorization 요청 인터셉터와
재발급 처리가 없고, `frontend/App.tsx`의 인증 상태는 메모리에만 존재한다.
설치된 영속 저장소도 없다.

## 제안 내용

### A1. 토큰 저장 매체

- Token Pair는 Android Keystore로 보호되는 암호화 저장소에 저장한다.
- React Native 구현은 `react-native-keychain`처럼 위 보안 속성을 충족하는
  저장 어댑터를 사용한다.
- AsyncStorage, 일반 SharedPreferences, 소스 코드, 로그에는 Access Token과
  Refresh Token을 평문으로 저장하지 않는다.
- 네트워크 요청을 위한 메모리 캐시는 허용하되 영속 저장소를 원본으로 본다.

### A2. 저장 단위

- 한 사용자 세션을 하나의 버전이 있는 레코드로 저장하고 Token Pair 회전 때
  전체를 교체한다.
- 최소 저장 항목은 `tokenType`, `accessToken`, `accessTokenExpiresAt`,
  `refreshToken`, `user{id,name}`이다.
- `accessTokenExpiresAt`은 서버의 `accessTokenExpiresIn`과 수신 시각으로
  계산한다.
- 현재 그룹 ID는 인증 세션과 분리하고 그룹 문맥 작업에서 관리한다.

### A3. 앱 재실행 복원

- 저장 레코드가 없거나 형식·버전 검증에 실패하면 로컬 값을 정리하고
  비로그인 상태로 시작한다.
- Access Token이 아직 유효하면 저장된 최소 사용자 정보로 인증 상태를
  복원한다.
- Access Token이 만료됐으면 `API-AUTH-004`를 한 번 호출한다. 성공하면 새
  Token Pair를 저장한 뒤 인증 상태를 복원한다.
- `400 INVALID_REQUEST` 또는 `401 INVALID_REFRESH_TOKEN`이면 인증 정보를
  지우고 비로그인 상태로 전환한다.
- 네트워크·타임아웃·5xx 같은 일시적 실패는 서버가 세션을 거부한 것이 아니므로
  저장 정보를 지우지 않는다. 인증 완료로도 간주하지 않고 재시도 가능한 복원
  오류로 전달한다.

### A4. Authorization과 재발급

- 보호 API 요청에는 `Authorization: Bearer <accessToken>`을 붙인다.
- `API-AUTH-001`~`004` 같은 공개 인증 요청에는 Access Token을 자동으로
  붙이지 않는다. 로그아웃은 유효한 Access Token과 body의 Refresh Token을
  함께 사용한다.
- 보호 API의 `401 UNAUTHORIZED`에만 자동 재발급을 시도하며 `403`에는
  재발급하지 않는다.
- 동시에 발생한 여러 `401`은 하나의 진행 중인 재발급 Promise를 공유한다.
  재발급을 병렬로 호출하지 않는다.
- 재발급 성공 시 새 Token Pair 저장을 완료한 뒤 대기 중인 원 요청을 각각
  한 번만 재시도한다.
- 재시도 요청, 재발급 요청 자체, 공개 인증 요청에는 재발급을 다시 적용하지
  않아 무한 반복을 막는다.

### A5. 인증 무효화 통지

- 확정적인 재발급 실패 또는 안전한 저장 교체 실패가 발생하면 인증 정보를
  한 번만 지우고 공통 `authInvalidated` 신호를 발생시킨다.
- 앱 루트는 이 신호로 사용자·그룹 관련 메모리 상태를 비우고 기존 비로그인
  진입 화면으로 전환한다.
- 이 작업에서 새 화면이나 안내 문구를 만들지 않는다.
- 오류 `message`는 공식 문구가 아닐 수 있으므로 분기는 HTTP 상태와 `code`로
  수행한다.

### A6. 로그아웃 실패

- 사용자가 로그아웃을 확정하면 서버 로그아웃 결과와 무관하게 현재 기기의
  로컬 인증 정보를 삭제하고 비로그인 상태로 전환한다.
- 서버 호출 실패는 호출자에게 반환해 기록·안내할 수 있게 하지만, 실패한
  Refresh Token을 로컬에 다시 저장하지 않는다.
- FCM token 비활성화 실패의 재시도 정책은 이 제안에서 결정하지 않는다.

검증 문장:

1. Token Pair가 Android Keystore 보호 저장소에 저장되고 앱 재실행 후 유효한
   세션만 복원된다.
2. 동시에 발생한 보호 API `401` 여러 건이 재발급 API 한 건만 발생시키고,
   성공 후 각 원 요청은 새 Access Token으로 한 번만 재시도된다.
3. `INVALID_REFRESH_TOKEN`이면 저장값과 메모리 인증 상태를 한 번만 지우고
   기존 비로그인 진입 화면으로 전환한다.
4. 네트워크 실패는 유효하지 않은 Refresh Token과 구분되어 저장 세션을
   임의로 삭제하지 않는다.
5. 화면 구현 없이 인증 상태 전이와 공통 API 계층만 변경된다.

## 변경 근거

- 서버는 Refresh Token을 원자 회전하고 기존 값을 즉시 무효화한다. 같은
  Refresh Token으로 병렬 재발급하면 한 요청만 성공하므로 클라이언트
  직렬화가 없으면 정상 세션도 강제 로그아웃될 수 있다.
- Refresh Token은 기본 14일 동안 인증을 다시 만들 수 있는 자격 증명이므로
  일반 비암호화 저장소에 두면 기기 백업·디버그·악성 앱 노출 위험이 커진다.
- `S15P11B104-141`의 완료 기준인 앱 재실행 복원과 재발급 실패 후 비로그인
  전환은 저장 형식·실패 분류·상태 전이 규칙 없이는 일관되게 검증할 수 없다.
- `frontend/src/shared/api/apiError.ts`는 HTTP 상태와 서버 오류 `code`를
  보존하므로 문구에 의존하지 않는 분기가 가능하다.
- `S15P11B104-142`는 로그인·로그아웃 API를 연결하고 이후 모든 보호 API
  연동이 같은 인증 기반을 사용하므로 공통 계약이다.

## 확인된 영향

- 영향 도메인: 모바일 인증 세션, 모든 보호 API 요청
- 영향 계약: `COMMON.md`의 클라이언트 인증 경계와
  `UI_AND_NAVIGATION.md`의 인증 상태 복원·무효화 전이
- 영향 화면: 새 화면 없음. 기존 로그인 진입 화면으로의 상태 전이만 사용
- 검증 범위: 저장·조회·삭제, 손상 레코드, 유효·만료 Access Token 복원,
  원자 Token Pair 교체, 동시 `401`, 원 요청 1회 재시도, `403`, 재발급
  400·401, 네트워크·타임아웃·5xx, 저장 실패, 로그아웃 실패

## 확인이 필요한 질문

1. A1~A6을 모두 공식 스펙으로 승인할지.
2. A3의 일시적 복원 실패에서 저장 세션을 유지하고 재시도 가능한 오류로
   남기는 대신 즉시 비로그인 상태로 전환할지.
3. A6의 서버 로그아웃 실패 후에도 로컬 인증 정보를 반드시 삭제할지.

## 결정 및 반영

- 결정: 승인 (A1~A6 권장안 전체. 질문 2의 즉시 비로그인 대안은 채택하지 않고, 질문 3의 로컬 인증정보 삭제안을 채택)
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서:
  - `docs/specs/COMMON.md`
  - `docs/specs/contracts/API.md`
  - `docs/specs/UI_AND_NAVIGATION.md`
  - `docs/specs/domains/ACCOUNT_AND_PROFILE.md`
  - `docs/specs/COVERAGE.md`
- 반영 커밋:
