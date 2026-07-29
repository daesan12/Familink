# Refresh Token 저장소와 만료 기준 확정

- 상태: 제안
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
- **인증 필터는 서명·만료 검증 후 블랙리스트를 조회**해 등록된 Access Token의 요청을 차단한다. 필터·블랙리스트 조회·재발급은 `S15P11B104-115`에서 구현한다.
- Refresh Token 유효 기간은 코드에 고정하지 않고 `backend/src/main/resources/application.yml`의 설정값으로 관리하며 기본값은 14일로 한다. Access Token 유효 기간도 같은 방식으로 관리하되 기본값은 Notion에 확정된 30분을 사용한다.
- Access Token은 서버에 저장하지 않는 자체 검증 토큰(JWT)이며 발급 시 Redis에 기록하지 않는다. Redis에는 로그아웃된 토큰만 블랙리스트로 남는다.

현재 develop의 구현(`S15P11B104-114`)은 Refresh Token을 불투명 난수 문자열로 발급하고 `auth:refresh:{토큰}` 키에 저장하는 과도기 상태다. `S15P11B104-115`에서 위 설계로 전환한다.

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
- 검증 범위: 로그인 후 Redis 키 만료 시간 확인, 로그아웃 후 키 삭제 확인은 `backend/src/test/java/com/ssafy/s15p11b104/domain/account/AuthApiTest.java`에서 검증했다. JWT 형식 전환·블랙리스트·단일 세션 덮어쓰기는 `S15P11B104-115`에서 통합 테스트로 검증한다.

## 확인이 필요한 질문

- 재발급 시 Refresh Token을 회전시켜 새 토큰으로 교체할지, 만료까지 재사용을 허용할지. `API-AUTH-004`가 응답에 `refreshToken`을 포함하는 점과 `refresh:{userId}` 단일 키 구조는 회전(덮어쓰기)을 시사한다. `S15P11B104-115`에서 확정한다.
- Refresh 14일이 팀 정책으로 적절한지. 피보호자(고령 사용자)가 자주 재로그인하지 않도록 더 길게 잡을 필요가 있는지.
- Redis 데이터가 유실되면 전체 사용자가 재로그인해야 한다. 이 운영 특성을 수용할 수 있는지.
- 회원 탈퇴(`API-USERS-003`) 시 해당 사용자의 Refresh Token을 함께 폐기해야 하는지. `S15P11B104-116`의 범위로 보인다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
