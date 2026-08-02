# Refresh Token 저장소와 만료 기준 확정

- 상태: 일부 승인
- 제안자: 이경호
- 작성일: 2026-07-28
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-AUTH-003`~`API-AUTH-005`, `contracts/DATA_MODEL.md` 데이터 소유권, `COMMON.md` 인증과 요청 경계
- 관련 작업: S15P11B104-114, S15P11B104-115
- 관련 제안: [`CHG-S15P11B104-114-common-response-envelope.md`](./CHG-S15P11B104-114-common-response-envelope.md)

## 기존 내용

`docs/specs/COMMON.md` 「인증과 요청 경계」는 토큰 사용 흐름만 규정한다.

> 클라이언트는 Access Token을 사용한다. Refresh Token 재발급은 `API-AUTH-004`, 로그아웃은 `API-AUTH-005` 계약을 따른다.

`docs/specs/contracts/DATA_MODEL.md` 17행의 테이블 소유권 목록에는 `users`부터 `device_tokens`까지 21개 테이블이 열거되어 있으나 토큰을 저장하는 테이블은 포함되어 있지 않다. 문서 전체에 Refresh Token 저장 구조에 대한 정의는 `device_tokens`(FCM 기기 토큰) 외에 없다.

팀 Notion 「API 명세서 2차 수정본」을 확인한 결과 다음은 이미 확정되어 있었다. 이 값들은 로컬 스펙에 누락된 것이므로 결정 대상이 아니다.

- `API-AUTH-003` 응답의 `accessTokenExpiresIn`은 `1800`이다. 즉 Access Token 유효 기간은 30분이다.
- `API-AUTH-003` 응답의 `tokenType`은 `Bearer`다.
- `API-AUTH-005`는 `204 No Content`이고 응답 본문이 없다.

## 제안 내용

2026-07-28 팀에서 확정한 Redis 토큰 설계를 다음과 같이 기록한다.

- **Refresh Token은 JWT로 발급한다.** Notion 명세 예시의 `eyJ...` 표기와 일치한다.
- **Redis 키는 `refresh:{userId}`, 값은 Refresh Token 문자열**이다. 키의 만료 시간은 Refresh Token 유효 기간과 동일하게 설정해 만료된 토큰이 자동으로 제거되게 한다.
- 이 키 구조는 **사용자당 활성 Refresh Token 1개(단일 세션)** 를 의미한다. 새 기기에서 로그인하면 기존 값이 덮어씌워지고, 이전 기기는 Access Token 만료 후 재로그인해야 한다. 2026-07-28 백엔드 담당자가 이 정책을 의도된 것으로 확인했다.
- **로그아웃은 두 가지를 수행한다.** Access Token을 `blacklist:{accessToken}` 키(값 `logout`, TTL은 해당 Access Token의 남은 만료 시간)로 등록하고, `refresh:{userId}` 키를 삭제한다.
- **인증 필터는 서명·만료 검증 후 블랙리스트를 조회**해 등록된 Access Token의 요청을 차단한다. 필터·블랙리스트 조회·재발급은 `S15P11B104-115`에서 구현했다.
- Refresh Token 유효 기간은 코드에 고정하지 않고 `backend/src/main/resources/application.yml`의 설정값으로 관리하며 기본값은 14일로 한다. Access Token 유효 기간도 같은 방식으로 관리하되 기본값은 Notion에 확정된 30분을 사용한다.
- Access Token은 서버에 저장하지 않는 자체 검증 토큰(JWT)이며 발급 시 Redis에 기록하지 않는다. Redis에는 로그아웃된 토큰만 블랙리스트로 남는다.

현재 develop은 `S15P11B104-115`에서 위 JWT·사용자별 단일 키·회전·블랙리스트 설계로 전환했다.

검증 문장: 로그인 응답의 `accessTokenExpiresIn`이 `1800`이고, 발급된 Refresh Token이 JWT 형식이며 `refresh:{userId}` 키의 만료 시간이 설정된 Refresh Token 유효 기간과 일치한다. 로그아웃 직후 같은 Access Token으로 보호 API를 호출하면 차단되고, 같은 Refresh Token으로 재발급을 요청하면 `401 INVALID_REFRESH_TOKEN`을 받는다.

## 변경 근거

- `API-AUTH-005`는 Refresh Token을 폐기해야 하므로 저장소가 필요하다. 저장소가 정의되지 않으면 이 API는 관찰 가능한 효과가 없는 구현이 된다.
- JWT인 Access Token은 발급 후 만료 전까지 자체적으로 유효하므로, 로그아웃 후 탈취된 토큰이 만료 시점까지 통과하는 문제를 막으려면 블랙리스트가 필요하다.
- `contracts/DATA_MODEL.md` 17행이 Spring Boot가 소유하는 테이블을 21개로 명시적으로 열거하고 있어, 토큰 테이블을 임의로 추가하면 데이터 계약과 충돌한다. Redis 저장은 테이블 목록을 변경하지 않는다.
- `backend/build.gradle`에 `spring-boot-starter-data-redis`가 포함되어 있고 `backend/compose.local.yml`이 로컬 개발용 `redis:7.4-alpine`을 기동한다.
- 2026-07-28 팀이 Redis 사용 설계(Refresh Token 저장, Access Token 블랙리스트, 향후 스케줄 작업 SETNX 잠금)를 확정했고, 백엔드 담당자가 구현 시점을 `S15P11B104-115`로 결정했다.

## 확인된 영향

- 영향 도메인: 계정·프로필의 로그인·로그아웃, 그리고 `S15P11B104-115`의 토큰 재발급·인증 필터
- 영향 계약: `COMMON.md` 「인증과 요청 경계」에 Refresh Token 저장 위치·유효 기간·단일 세션 정책과 로그아웃의 블랙리스트 동작을 추가한다. `contracts/API.md`에 Access Token 30분과 `tokenType=Bearer`를 기록한다. Method, Path, 요청·응답 필드 구성과 `contracts/DATA_MODEL.md`의 테이블 구성은 변경하지 않는다.
- 영향 화면: 확인 필요. 단일 세션 정책으로 다른 기기에서 로그인하면 기존 기기가 Access Token 만료 후 로그아웃되므로, 클라이언트의 재발급 실패 처리(재로그인 유도)가 이 상황을 자연스럽게 안내해야 한다.
- 클라이언트 구현 제약: 재발급은 **단일 비행(single-flight)으로 큐잉**해야 한다. 회전은 저장된 토큰과 제시된 토큰이 같을 때만 성공하므로, 여러 API 호출이 동시에 `401`을 받아 재발급을 병렬로 호출하면 하나만 성공하고 나머지는 `401 INVALID_REFRESH_TOKEN`을 받는다. 이때 클라이언트가 `401`을 곧바로 세션 만료로 해석하면 살아 있는 세션에서 사용자가 강제 로그아웃된다. 진행 중인 재발급이 있으면 그 결과를 공유하도록 구현해야 한다.
- 검증 범위: 로그인 후 Redis 키 만료 시간, JWT 형식, 단일 세션 덮어쓰기,
  재발급 회전, 로그아웃의 Refresh Token 삭제와 Access Token 블랙리스트는
  `backend/src/test/java/com/ssafy/s15p11b104/domain/account/AuthApiTest.java`와
  `backend/src/test/java/com/ssafy/s15p11b104/global/security/RefreshTokenStoreTest.java`에서 검증한다.

## 확인이 필요한 질문

- 승인된 회전 시 14일 TTL 재설정 외에 최초 발급 시각 기준의 절대 세션
  상한을 추가할지.
- 승인된 원자적 회전에서 병렬 요청의 패자가 `401`을 받는 현재 서버 동작을
  전제로 클라이언트 단일 비행을 구현할지, 서버가 직전 토큰을 짧은 유예
  시간 동안 허용하는 별도 정책을 추가할지.
- Redis 데이터가 유실되면 전체 사용자가 재로그인해야 한다. 이 운영 특성을 수용할 수 있는지.
- 회원 탈퇴(`API-USERS-003`) 시 해당 사용자의 Refresh Token을 함께 폐기해야 하는지. `S15P11B104-116`의 범위로 보인다.

## 결정 및 반영

- 결정: 일부 승인. Access Token JWT·`Bearer`·기본 30분,
  Refresh Token JWT·`refresh:{userId}` 단일 키·기본 14일 TTL, 새 로그인
  시 기존 세션 교체, 원자적 회전과 기존 토큰 재사용 거부, 회전 시 14일 TTL
  재설정, Access Token 블랙리스트와 현재 Refresh Token 폐기를 승인한다.
  병렬 재발급을 처리할 클라이언트 단일 비행, Redis 유실 수용 여부, 회원
  탈퇴 시 토큰 폐기는 미구현·미확정이므로 승인 범위에서 제외하고 보류한다.
- 결정자: 사용자
- 결정일: 2026-07-29
- 승인 근거: 사용자가 이미 확정되었거나 구현된 부분만 승인한다고 명시했다.
- 반영 문서: `docs/specs/COMMON.md`, `docs/specs/contracts/API.md`
- 반영 커밋:
