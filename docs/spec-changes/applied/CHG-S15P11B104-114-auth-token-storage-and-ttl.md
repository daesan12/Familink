# Refresh Token 저장소와 만료 기준 확정

- 상태: 승인·반영 완료
- 제안자: 이경호
- 작성일: 2026-07-28
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-AUTH-003`~`API-AUTH-005`, `contracts/DATA_MODEL.md` 데이터 소유권, `COMMON.md` 인증과 요청 경계
- 관련 작업: S15P11B104-114, S15P11B104-115
- 관련 제안: [`CHG-S15P11B104-114-common-response-envelope.md`](../pending/CHG-S15P11B104-114-common-response-envelope.md)

## 기존 내용

`docs/specs/COMMON.md` 「인증과 요청 경계」는 토큰 사용 흐름만 규정한다.

> 클라이언트는 Access Token을 사용한다. Refresh Token 재발급은 `API-AUTH-004`, 로그아웃은 `API-AUTH-005` 계약을 따른다.

`docs/specs/contracts/DATA_MODEL.md` 17행의 테이블 소유권 목록에는 `users`부터 `device_tokens`까지 21개 테이블이 열거되어 있으나 토큰을 저장하는 테이블은 포함되어 있지 않다. 문서 전체에 Refresh Token 저장 구조에 대한 정의는 `device_tokens`(FCM 기기 토큰) 외에 없다.

팀 Notion 「API 명세서 2차 수정본」을 확인한 결과 다음은 이미 확정되어 있었다. 이 값들은 로컬 스펙에 누락된 것이므로 결정 대상이 아니다.

- `API-AUTH-003` 응답의 `accessTokenExpiresIn`은 `1800`이다. 즉 Access Token 유효 기간은 30분이다.
- `API-AUTH-003` 응답의 `tokenType`은 `Bearer`다.
- `API-AUTH-005`는 `204 No Content`이고 응답 본문이 없다.

2026-08-11 로컬 스펙 재점검에서 새 로그인 정책의 공식 문서 간 충돌을
확인했다. `docs/specs/COMMON.md` 「인증과 요청 경계」는 새 로그인이 기존
Refresh Token을 덮어쓴다고 규정하지만, 2026-08-04의 hardening 커밋
`5b3c954b54ca20c2258c615d6db912c4182fd584`가 추가한
`docs/specs/contracts/API.md` 「Hardening 계약 추가」와
`docs/specs/domains/ACCOUNT_AND_PROFILE.md` 「로그인 보안 보강 계약」은 활성
Refresh Token이 있으면 기존 세션을 보존하고 `409 ACTIVE_SESSION_EXISTS`를
반환한다고 규정한다.

## 제안 내용

2026-07-28 팀에서 확정한 Redis 토큰 설계를 다음과 같이 기록한다.

- **Refresh Token은 JWT로 발급한다.** Notion 명세 예시의 `eyJ...` 표기와 일치한다.
- **Redis 키는 `refresh:{userId}`, 값은 Refresh Token 문자열**이다. 키의 만료 시간은 Refresh Token 유효 기간과 동일하게 설정해 만료된 토큰이 자동으로 제거되게 한다.
- 이 키 구조는 **사용자당 활성 Refresh Token 1개(단일 세션)** 를 의미한다.
  새 로그인은 Redis `SET NX`로 활성 세션이 없을 때만 성공한다. 이미 활성
  Refresh Token이 있으면 기존 값과 세션을 보존하고
  `409 ACTIVE_SESSION_EXISTS`를 반환한다.
- **로그아웃은 두 가지를 수행한다.** Access Token을 `blacklist:{accessToken}` 키(값 `logout`, TTL은 해당 Access Token의 남은 만료 시간)로 등록하고, `refresh:{userId}` 키를 삭제한다.
- **인증 필터는 서명·만료 검증 후 블랙리스트를 조회**해 등록된 Access Token의 요청을 차단한다. 필터·블랙리스트 조회·재발급은 `S15P11B104-115`에서 구현했다.
- Refresh Token 유효 기간은 코드에 고정하지 않고 `backend/src/main/resources/application.yml`의 설정값으로 관리하며 기본값은 14일로 한다. Access Token 유효 기간도 같은 방식으로 관리하되 기본값은 Notion에 확정된 30분을 사용한다.
- Access Token은 서버에 저장하지 않는 자체 검증 토큰(JWT)이며 발급 시
  Redis에 기록하지 않는다. 로그아웃의 토큰 단위 블랙리스트와 회원 탈퇴의
  사용자 단위 블랙리스트는 만료 전 요청 차단을 위해 Redis에 남는다.

현재 develop은 `S15P11B104-115`에서 위 JWT·사용자별 단일 키·회전·블랙리스트 설계로 전환했다.

검증 문장: 로그인 응답의 `accessTokenExpiresIn`이 `1800`이고, 발급된 Refresh Token이 JWT 형식이며 `refresh:{userId}` 키의 만료 시간이 설정된 Refresh Token 유효 기간과 일치한다. 활성 Refresh Token이 있는 상태의 두 번째 로그인은 기존 저장값을 유지하고 `409 ACTIVE_SESSION_EXISTS`를 반환한다. 로그아웃 직후 같은 Access Token으로 보호 API를 호출하면 차단되고, 같은 Refresh Token으로 재발급을 요청하면 `401 INVALID_REFRESH_TOKEN`을 받는다.

## 변경 근거

- `API-AUTH-005`는 Refresh Token을 폐기해야 하므로 저장소가 필요하다. 저장소가 정의되지 않으면 이 API는 관찰 가능한 효과가 없는 구현이 된다.
- JWT인 Access Token은 발급 후 만료 전까지 자체적으로 유효하므로, 로그아웃 후 탈취된 토큰이 만료 시점까지 통과하는 문제를 막으려면 블랙리스트가 필요하다.
- `contracts/DATA_MODEL.md` 17행이 Spring Boot가 소유하는 테이블을 21개로 명시적으로 열거하고 있어, 토큰 테이블을 임의로 추가하면 데이터 계약과 충돌한다. Redis 저장은 테이블 목록을 변경하지 않는다.
- `backend/build.gradle`에 `spring-boot-starter-data-redis`가 포함되어 있고 `backend/compose.local.yml`이 로컬 개발용 `redis:7.4-alpine`을 기동한다.
- 2026-07-28 팀이 Redis 사용 설계(Refresh Token 저장, Access Token 블랙리스트, 향후 스케줄 작업 SETNX 잠금)를 확정했고, 백엔드 담당자가 구현 시점을 `S15P11B104-115`로 결정했다.
- 2026-08-04의 `5b3c954b54ca20c2258c615d6db912c4182fd584`는 로그인
  구현과 테스트를 `issueIfAbsent` 및 `409 ACTIVE_SESSION_EXISTS` 방식으로
  바꿨다. 같은 커밋의 applied 제안
  `CHG-S15P11B104-253-login-rate-limit.md`가 기록한 승인 범위는 로그인 시도
  제한과 자격 증명 길이뿐이어서, 활성 세션 처리 정책을 변경한다는 명시적
  승인 근거는 확인되지 않는다.

## 확인된 영향

- 영향 도메인: 계정·프로필의 로그인·로그아웃, 그리고 `S15P11B104-115`의 토큰 재발급·인증 필터
- 영향 계약: `COMMON.md` 「인증과 요청 경계」에 Refresh Token 저장 위치·유효 기간·단일 세션 정책과 로그아웃의 블랙리스트 동작을 추가한다. `contracts/API.md`에 Access Token 30분과 `tokenType=Bearer`를 기록한다. Method, Path, 요청·응답 필드 구성과 `contracts/DATA_MODEL.md`의 테이블 구성은 변경하지 않는다.
- 영향 화면: 활성 세션이 있는 계정의 새 로그인 요청은
  `409 ACTIVE_SESSION_EXISTS`를 표시하고 기존 기기의 세션은 유지한다. 별도
  세션 교체 화면은 추가하지 않는다.
- 해소한 공식 계약 충돌: `COMMON.md`와 이 제안의 2026-07-29 일부 승인
  기록이 가리키던 기존 세션 교체 정책을 폐기하고, 현재 서버 구현과
  `contracts/API.md`·`ACCOUNT_AND_PROFILE.md`의 활성 세션 보존·새 로그인
  `409 ACTIVE_SESSION_EXISTS` 정책으로 통일했다.
- 클라이언트 구현 제약: 재발급은 **단일 비행(single-flight)으로 큐잉**해야 한다. 회전은 저장된 토큰과 제시된 토큰이 같을 때만 성공하므로, 여러 API 호출이 동시에 `401`을 받아 재발급을 병렬로 호출하면 하나만 성공하고 나머지는 `401 INVALID_REFRESH_TOKEN`을 받는다. 이때 클라이언트가 `401`을 곧바로 세션 만료로 해석하면 살아 있는 세션에서 사용자가 강제 로그아웃된다. 진행 중인 재발급이 있으면 그 결과를 공유하도록 구현해야 한다.
- 검증 범위: 로그인 후 Redis 키 만료 시간, JWT 형식, 활성 세션 보존과
  중복 로그인 거부,
  재발급 회전, 로그아웃의 Refresh Token 삭제와 Access Token 블랙리스트는
  `backend/src/test/java/com/ssafy/s15p11b104/domain/account/AuthApiTest.java`와
  `backend/src/test/java/com/ssafy/s15p11b104/global/security/RefreshTokenStoreTest.java`에서 검증한다.

## 현재 구현 기준으로 확정한 동작

- Refresh Token 회전은 TTL을 기본 14일로 다시 설정하며 최초 로그인 시각
  기준의 별도 절대 세션 상한은 두지 않는다.
- 같은 Refresh Token의 병렬 재발급은 한 요청만 성공하고 나머지는
  `401 INVALID_REFRESH_TOKEN`을 받는다. 클라이언트는 하나의 진행 중인
  재발급 Promise를 공유한다. 이 계약은
  [`CHG-S15P11B104-141-client-auth-session-lifecycle.md`](./CHG-S15P11B104-141-client-auth-session-lifecycle.md)에 반영됐다.
- Redis에서 사용자별 Refresh Token 키가 유실되면 재발급할 수 없으므로 다시
  로그인한다. 이미 발급된 Access Token은 만료 또는 블랙리스트 등록 전까지
  자체 검증 규칙을 따른다.
- 회원 탈퇴의 Refresh Token 폐기와 사용자 단위 Access Token 차단은 현재
  서버 구현대로 공식 인증 계약에 반영했다. 활성 멤버십 종료·관리자 조건·
  탈퇴 작성자 표시 같은 나머지 부수효과는 별도 제안
  [`CHG-S15P11B104-116-withdrawal-side-effects.md`](../pending/CHG-S15P11B104-116-withdrawal-side-effects.md)의 범위로 유지한다.
- 새 로그인은 활성 세션을 교체하지 않는다. 기존 Refresh Token을 보존하고
  `409 ACTIVE_SESSION_EXISTS`로 거부한다.

## 결정 및 반영

- 결정: 승인·반영 완료. Access Token JWT·`Bearer`·기본 30분,
  Refresh Token JWT·`refresh:{userId}` 단일 키·기본 14일 TTL, 활성 세션
  보존과 중복 로그인 `409 ACTIVE_SESSION_EXISTS`, 원자적 회전과 기존 토큰
  재사용 거부, 회전 시 14일 TTL 재설정, Access Token 블랙리스트와 현재
  Refresh Token 폐기를 현재 구현 기준으로 승인한다. 2026-07-29 일부 승인에
  포함됐던 "새 로그인 시 기존 세션 교체" 결정은 이번 결정으로 대체한다.
- 결정자: 사용자
- 결정일: 2026-08-14
- 승인 근거: 프로젝트 종료 후 Jira 기준이 아니라 현재 서버 구현을 공식
  스펙으로 맞추라고 사용자가 명시했다.
- 반영 문서: `docs/specs/COMMON.md`, `docs/specs/contracts/API.md`,
  `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/COVERAGE.md`
- 구현·검증 근거: `AuthService.login`, `RefreshTokenStore`, `AuthApiTest`,
  `UserService.withdraw`, `AccessTokenBlacklist`, `WithdrawalTokenRevocationTest`,
  `AuthSessionManager.refreshAccessToken`, `authSessionManager.test.ts`
- 반영 커밋:
