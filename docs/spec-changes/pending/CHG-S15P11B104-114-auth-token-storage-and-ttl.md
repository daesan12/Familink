# Refresh Token 저장소와 토큰 만료 기준 확정

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

`docs/specs/contracts/API.md`는 응답 필드에 `accessTokenExpiresIn`이 포함된다고만 적고 그 값의 기준을 정의하지 않는다.

- `API-AUTH-003` 성공 결과: `tokenType`, `accessToken`, `accessTokenExpiresIn`, `refreshToken`, `user{id,name}`
- `API-AUTH-005` `POST /auth/logout`: 요청 `refreshToken`, 성공 `204 No Content`

`docs/specs/contracts/DATA_MODEL.md` 17행의 테이블 소유권 목록에는 `users`부터 `device_tokens`까지 21개 테이블이 열거되어 있으나 토큰을 저장하는 테이블은 포함되어 있지 않다. 문서 전체에 `refresh`, `token` 저장 구조에 대한 정의는 `device_tokens`(FCM 기기 토큰) 외에 없다.

정리하면 다음 세 가지가 정의되어 있지 않다.

1. Refresh Token을 어디에 저장하는지.
2. Access Token과 Refresh Token의 유효 기간.
3. 로그아웃이 Refresh Token을 무효화하는 방식.

## 제안 내용

- Refresh Token은 PostgreSQL이 아니라 Redis에 저장한다. `contracts/DATA_MODEL.md`의 테이블 목록은 변경하지 않는다.
  - 키는 Refresh Token 자체를 식별자로 사용하고, 값은 해당 토큰의 소유자 사용자 ID를 담는다.
  - Redis 키의 만료 시간을 Refresh Token 유효 기간과 동일하게 설정해 만료된 토큰이 자동으로 제거되게 한다.
- Access Token은 서버에 저장하지 않는 자체 검증 토큰(JWT)으로 발급한다.
- 토큰 유효 기간은 코드에 고정하지 않고 `backend/src/main/resources/application.yml`의 설정값으로 관리한다. 기본값은 다음으로 확정한다.
  - Access Token: 30분
  - Refresh Token: 14일
- `API-AUTH-003`의 `accessTokenExpiresIn`은 Access Token 유효 기간을 초 단위 정수로 반환한다. 기본 설정에서는 `1800`이다.
- `API-AUTH-003`의 `tokenType`은 `Bearer`를 반환한다.
- `API-AUTH-005` 로그아웃은 요청받은 Refresh Token에 해당하는 Redis 키를 삭제해 재발급 불가 상태로 만든다. 저장되어 있지 않거나 이미 삭제된 Refresh Token으로 로그아웃을 요청하면 `401 UNAUTHORIZED`로 처리한다.
- `API-AUTH-005`의 권한은 Refresh Token 소지 자체로 판정한다. 즉 Access Token 없이 호출할 수 있고, 저장된 Refresh Token을 제시하지 못하면 `401 UNAUTHORIZED`가 된다.

`API-AUTH-005`의 계약상 권한과 이 제안의 차이를 다음과 같이 기록한다. 계약은 권한을 `Spring Boot · 토큰 소유자`로 적고 명시 오류에 `403 FORBIDDEN`을 포함하는데, Refresh Token 소지만으로 소유자를 판정하는 위 방식에서는 `403`이 발생할 수 있는 경로가 없다. `403`은 인증된 사용자가 자신의 것이 아닌 Refresh Token을 폐기하려는 경우에만 의미가 있고, 그 판정에는 Access Token 기반 인증 필터가 필요하다. 이 필터는 `S15P11B104-115`의 범위이므로 `S15P11B104-114` 구현에서 `/auth/logout`은 공개 경로로 열려 있다. `S15P11B104-115`에서 이 경로를 인증 대상으로 옮기고 `403` 조건을 확정할지, 또는 계약에서 `403`을 제거할지 결정해야 한다.

검증 문장: 로그인 응답의 `accessTokenExpiresIn`이 설정된 Access Token 유효 기간의 초 값과 일치하고, 로그아웃 후 같은 Refresh Token으로 `API-AUTH-004` 재발급을 시도하면 `401 INVALID_REFRESH_TOKEN`을 받는다.

## 변경 근거

- `API-AUTH-005`는 요청 본문으로 `refreshToken`을 받아 `204`를 반환해야 한다. 로그아웃이 관찰 가능한 효과를 가지려면 해당 토큰을 무효화할 저장소가 필요하며, 저장소가 정의되지 않으면 이 API는 아무 동작도 하지 않는 구현이 된다.
- `contracts/DATA_MODEL.md` 17행이 Spring Boot가 소유하는 테이블을 21개로 명시적으로 열거하고 있어, 토큰 테이블을 임의로 추가하면 데이터 계약과 충돌한다.
- `backend/build.gradle` 23행에 `spring-boot-starter-data-redis`가 포함되어 있고, `backend/compose.local.yml`이 로컬 개발용 `redis:7.4-alpine`을 기동한다. 즉 Redis는 이미 프로비저닝되어 있으나 그 용도가 스펙에 기록되어 있지 않다.
- `accessTokenExpiresIn`을 응답에 포함하도록 계약이 요구하므로 유효 기간 값 없이는 `API-AUTH-003`을 구현할 수 없다.
- 2026-07-28 사용자(백엔드 담당)가 Redis 저장과 설정 가능한 만료 시간(Access 30분, Refresh 14일 기본값)을 선택했다.

## 확인된 영향

- 영향 도메인: 계정·프로필의 로그인·로그아웃, 그리고 `S15P11B104-115`의 토큰 재발급
- 영향 계약:
  - `API-AUTH-003`의 `accessTokenExpiresIn`·`tokenType` 값 기준
  - `API-AUTH-004` 재발급 성공 조건
  - `API-AUTH-005` 무효화 동작
  - `API-AUTH-005`의 「백엔드·권한」 셀. 현재 `Spring Boot · 토큰 소유자`이며 소유자 판정 기준을 Refresh Token 소지로 구체화해야 한다.
  - `API-AUTH-005`의 「명시 오류」 셀. 현재 포함된 `403 FORBIDDEN`의 유지 여부를 결정해야 한다.
  - Method, Path, 요청·응답 필드 구성은 변경하지 않는다. `contracts/DATA_MODEL.md`의 테이블 구성도 변경하지 않는다.
- 영향 화면: 확인 필요. 클라이언트가 Access Token 만료 시점을 기준으로 재발급을 호출하는 시점 정책에 영향을 준다.
- 검증 범위: 로그인 후 로그아웃, 로그아웃 후 재발급 실패까지의 통합 테스트. Redis 연동은 `backend/src/test/java/com/ssafy/s15p11b104/support/IntegrationTest.java`의 Testcontainers 기반 클래스를 상속해 검증한다.

## 확인이 필요한 질문

- Access 30분·Refresh 14일이 팀 전체 정책으로 적절한지. 특히 피보호자(고령 사용자)가 자주 재로그인하지 않도록 Refresh 기간을 더 길게 잡을 필요가 있는지.
- 재발급 시 Refresh Token을 회전(rotation)시켜 기존 토큰을 폐기할지, 만료까지 재사용을 허용할지. `API-AUTH-004`가 응답에 `refreshToken`을 포함하는 점은 회전을 시사하지만 명시되어 있지 않다. 이 결정은 `S15P11B104-115`에서 필요하다.
- 한 사용자가 여러 기기에서 동시에 로그인할 때 Refresh Token을 여러 개 유지할지, 최신 하나만 유지할지.
- Redis 데이터가 유실되면 전체 사용자가 재로그인해야 한다. 이 운영 특성을 수용할 수 있는지.
- 회원 탈퇴(`API-USERS-003`) 시 해당 사용자의 Refresh Token을 함께 폐기해야 하는지. 현재 제안에는 포함하지 않았으며 `S15P11B104-116`의 범위로 보인다.
- `API-AUTH-005`의 `403 FORBIDDEN`을 유지할 것인지. 유지한다면 `S15P11B104-115`에서 `/auth/logout`을 Access Token 인증 대상으로 옮기고 Refresh Token 소유자와 인증 사용자가 다른 경우로 `403`을 정의해야 한다. 유지하지 않는다면 계약에서 제거해야 한다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
