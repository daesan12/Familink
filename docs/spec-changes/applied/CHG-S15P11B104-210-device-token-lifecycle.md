# 기기 푸시 토큰 소유권·재등록·비활성화 계약 확정

- 상태: 승인·반영 완료
- 제안자: Codex
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `API-AUTH-005`, `API-NOTIFICATIONS-001`, `API-NOTIFICATIONS-008`, `NOTIFICATIONS`, `device_tokens`
- 관련 작업: `S15P11B104-210` N1~N8
- 관련 제안: [`CHG-S15P11B104-114-auth-token-storage-and-ttl.md`](../pending/CHG-S15P11B104-114-auth-token-storage-and-ttl.md), [`CHG-S15P11B104-114-common-response-envelope.md`](../pending/CHG-S15P11B104-114-common-response-envelope.md), [`CHG-S15P11B104-116-withdrawal-side-effects.md`](../pending/CHG-S15P11B104-116-withdrawal-side-effects.md)

## 기존 내용

`docs/specs/contracts/API.md`는 `API-NOTIFICATIONS-001`의 신규 등록 `201`과
`API-NOTIFICATIONS-008`의 `204`만 정의한다. 토큰은 전역 Unique지만 같은
토큰을 다시 등록할 때 기존 행의 사용자와 활성 상태를 어떻게 바꿀지는
미결정이다.

`docs/specs/domains/NOTIFICATIONS.md`도 중복 행을 만들지 않는다는 원칙과
활성·비활성 상태만 정한다. 로그인 복원, 토큰 갱신, 계정 전환, 로그아웃,
권한 철회와 회원 탈퇴 때의 수명주기 및 `deviceType` 입력 규칙은 없다.

`docs/specs/contracts/DATA_MODEL.md`의 `device_tokens`에는
`token VARCHAR(500) UNIQUE`, `device_type VARCHAR(20)`, `is_active`가
있지만 소유권 이전과 API 상태 코드 의미는 정의하지 않는다.

## 제안 내용

### N1. 전역 소유권

- 같은 token 문자열은 전체 시스템에서 한 행만 가진다.
- 활성 token은 동시에 한 사용자만 소유한다.
- 등록은 Unique 제약과 행 잠금 또는 동등한 원자적 upsert로 처리해 동시
  요청에서도 중복 행이나 복수 활성 소유자가 생기지 않게 한다.

### N2. 같은 사용자의 재등록

- 기존 행의 `id`를 유지한다.
- `is_active=true`로 복구하고 `device_type`, `updated_at`을 갱신한다.
- 신규 행이 아니므로 `200 OK`를 반환한다.

### N3. 다른 사용자의 같은 token 등록

- 계정 전환으로 보고 같은 행의 소유자를 새 인증 사용자로 원자적으로
  이전한다.
- `id`를 유지하고 `is_active=true`, `device_type`, `updated_at`을
  갱신하며 `200 OK`를 반환한다.
- 이전 사용자에게 해당 token으로 푸시를 보내지 않는다.
- 정확한 opaque token을 제출한 인증 사용자를 현재 기기의 token 보유자로
  보고 이전 사용자의 추가 확인 없이 소유권을 이전한다.

### N4. 앱 등록 시점

- 로그인 성공 또는 인증 세션 복원 후 OS 알림 권한과 token이 있으면
  `API-NOTIFICATIONS-001`을 호출한다.
- FCM token이 갱신됐고 사용자가 인증된 상태면 같은 API를 다시 호출한다.
- 인증되지 않은 상태에서 받은 token은 로컬에 보관했다가 인증 후 등록한다.
- 계정 전환은 기존 계정으로 `API-NOTIFICATIONS-008` 호출, 로그아웃, 새
  계정 로그인, 새 계정으로 `API-NOTIFICATIONS-001` 호출 순서로 처리한다.
- OS 알림 권한이 거부된 상태에서는 등록 API를 호출하지 않는다.

### N5. 로그아웃·권한 철회·회원 탈퇴

- 정상 로그아웃과 인증 상태에서 처리할 수 있는 OS 알림 권한 철회는 현재
  기기의 token만 비활성화한다. 사용자의 다른 기기 token은 유지한다.
- 일반 로그아웃은 인증이 유효할 때 현재 token으로
  `API-NOTIFICATIONS-008`을 먼저 호출한 뒤 `API-AUTH-005`를 호출한다.
  권한 철회도 현재 또는 직전에 발급받아 보관 중인 token을 인증 상태에서
  비활성화한다.
- 회원 탈퇴는 Spring Boot가 해당 사용자의 모든 `device_tokens`를 같은
  탈퇴 트랜잭션에서 비활성화한다.
- `API-NOTIFICATIONS-008` 실패 시 로그아웃 지속·재시도 방식과 인증되지
  않은 상태에서 감지한 권한 철회의 서버 비활성화 방식은 이 결정 범위에
  포함하지 않고 미결정으로 남긴다.

### N6. 비활성화 API

- `API-NOTIFICATIONS-008`은 행을 삭제하지 않고 `is_active=false`로 바꾼다.
- 본인 소유 token이 없거나 이미 비활성이라도 `204 No Content`를 반환한다.
- 다른 사용자가 소유한 token이면 `403 FORBIDDEN`, 잘못된 요청이면
  `400 INVALID_REQUEST`, 인증이 없거나 유효하지 않으면
  `401 UNAUTHORIZED`다.

### N7. 입력 규칙

- MVP의 `deviceType` 허용값은 정확히 `ANDROID` 하나다.
- `token`은 공백이 아닌 최대 500자의 opaque 문자열이다. 서버는 임의 정규식,
  대소문자 변경 또는 형식 변환을 적용하지 않는다.
- 위 규칙을 어기면 `400 INVALID_REQUEST`다.

### N8. 성공 응답

- 처음 생성한 token은 `201 Created`, 재등록·재활성화·소유권 이전은
  `200 OK`다.
- 두 성공 응답은 모두 같은 성공 문구 `기기 토큰 등록 성공`과
  `data={id,deviceType,active}`를 반환하며 `active`는 `true`다.
- 비활성화 성공은 `204 No Content`이며 본문이 없다.

## 변경 근거

- 2026-07-31 사용자는 N1~N8을 권장안대로 결정했다.
- 전역 Unique만 있고 재등록 정책이 없으면 기기 재설치와 계정 전환에서
  Unique 충돌을 오류로 처리하거나 이전 계정에 푸시를 보낼 수 있다.
- 소프트 비활성화는 재등록 시 같은 행을 재사용하고 수명주기를 추적하는
  현재 데이터 구조와 맞는다.
- Access/Refresh Token과 FCM token은 목적이 다르다. 관련 인증 제안은
  인증 token 폐기를 다루며 이 제안은 `device_tokens`만 다룬다.

## 확인된 영향

- 영향 도메인: 앱·푸시 알림, 인증 세션 복원·로그아웃, 회원 탈퇴
- 영향 계약: `API-AUTH-005`, `API-NOTIFICATIONS-001`,
  `API-NOTIFICATIONS-008`, `API-USERS-003`, `device_tokens`
- 영향 화면: 알림 권한과 로그인·로그아웃·계정 전환 흐름
- 검증 범위: 신규·재등록·재활성화·소유권 이전, 동시 등록, 권한별 DELETE,
  다른 기기 보존, 탈퇴 전체 비활성화

## 결정 및 반영

- 결정: 승인(전체). `S15P11B104-210`의 N1~N8을 제안 내용대로 반영한다.
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/contracts/DATA_MODEL.md`,
  `docs/specs/domains/NOTIFICATIONS.md`,
  `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
