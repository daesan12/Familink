# 가입 요청 API의 오류 표면과 권한 실패 코드 정리

- 상태: 제안
- 제안자: 이경호
- 작성일: 2026-07-29
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-GROUPS-003`·`API-GROUPS-008`·`API-GROUPS-009`, 「공통 경계」
- 관련 작업: S15P11B104-118
- 관련 제안: [`CHG-S15P11B104-117-group-lifecycle-error-codes.md`](./CHG-S15P11B104-117-group-lifecycle-error-codes.md)

## 기존 내용

`docs/specs/contracts/API.md` 76·81~82행의 「명시 오류」는 다음과 같다.

- `API-GROUPS-003`(`POST /join-requests/by-code`): `400 INVITE_CODE_INVALID`; `409 ALREADY_GROUP_MEMBER`; `409 JOIN_REQUEST_ALREADY_EXISTS`
- `API-GROUPS-008`(`GET /groups/{groupId}/join-requests`): `403 NOT_GROUP_MANAGER`
- `API-GROUPS-009`(`PATCH /groups/{groupId}/join-requests/{joinRequestId}`): `400 INVALID_JOIN_REQUEST_DECISION`; `400 ASSIGNED_ROLE_REQUIRED`; `403 NOT_GROUP_MANAGER`; `404 JOIN_REQUEST_NOT_FOUND`; `409 JOIN_REQUEST_ALREADY_PROCESSED`; `409 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP`

세 API 모두 인증이 필요하지만 `401 UNAUTHORIZED`가 열거되어 있지 않다. 같은 문서 44행은 "그룹 데이터는 해당 그룹의 활성 구성원 범위에서만 접근한다"고 규정하고, `API-GROUPS-004`·`005`·`007`은 `400 INVALID_REQUEST`·`401 UNAUTHORIZED`·`403 FORBIDDEN`을 함께 열거한다.

또 `API-GROUPS-008`의 핵심 요청은 `path groupId; query status`인데, `status`가 필수인지 선택인지와 허용되지 않은 값이 왔을 때의 응답이 정의되어 있지 않다.

같은 문서 안에서 권한 실패 코드가 세 갈래로 갈린다.

| 코드 | 사용 API |
|---|---|
| `403 FORBIDDEN` | `API-GROUPS-004`·`005`·`006`·`007`·`010`~`014`, `API-ALIASES-001`, `API-INTERESTS-001` |
| `403 NOT_GROUP_MANAGER` | `API-GROUPS-008`·`009` |
| `403 NOT_GROUP_MEMBER` | `API-GROUPS-015` |

## 제안 내용

### 1. 누락된 `401`을 명시한다

`API-GROUPS-003`·`008`·`009`의 「명시 오류」에 `401 UNAUTHORIZED`를 추가한다. Access Token이 없거나 만료·위조된 요청은 이미 인증 필터에서 차단되므로 동작 변경이 아니라 계약 누락분의 기록이다.

### 2. `API-GROUPS-008`의 `status`를 선택 파라미터로 확정한다

- `status`를 생략하면 해당 그룹의 모든 가입 요청을 최신순으로 반환한다.
- `status`를 주면 `PENDING_ADMIN`·`APPROVED`·`REJECTED` 중 하나로 필터링한다.
- 허용되지 않은 값이면 `400 INVALID_REQUEST`를 반환한다.

검증 문장: 관리자가 `status` 없이 호출하면 처리된 요청까지 모두 조회되고, `status=PENDING_ADMIN`으로 호출하면 대기 중 요청만 조회되며, `status=UNKNOWN`이면 `400`을 받는다.

### 3. 권한 실패 코드를 하나로 통일한다

그룹 범위 API의 권한 실패를 `403 FORBIDDEN` 하나로 통일하고, `NOT_GROUP_MANAGER`와 `NOT_GROUP_MEMBER`를 계약에서 제거한다. 대안으로 반대 방향(관리자 전용 API는 모두 `NOT_GROUP_MANAGER`, 구성원 전용 API는 모두 `NOT_GROUP_MEMBER`)도 가능하나, 이미 다수 API가 `FORBIDDEN`을 쓰므로 변경 범위가 작은 쪽은 통일이다.

이 항목은 결정 전까지 구현하지 않는다. 2026-07-29 구현은 현재 계약을 문자 그대로 따라 `API-GROUPS-008`·`009`에만 `NOT_GROUP_MANAGER`를 반환하고, `API-GROUPS-007`에는 `FORBIDDEN`을 반환한다. 즉 같은 그룹의 비관리자 구성원이 초대 코드를 조회하면 `FORBIDDEN`, 가입 요청 목록을 조회하면 `NOT_GROUP_MANAGER`를 받는다.

### 4. 초대 코드 대조 규칙을 확정한다

`API-GROUPS-003`의 `inviteCode` 대조를 다음으로 확정한다.

- 앞뒤 공백을 제거한 뒤 대문자로 정규화해 대조한다.
- 정규화 결과가 빈 문자열이면 `400 INVITE_CODE_INVALID`로 처리한다.

`family_groups.invite_code`는 서버가 대문자 영숫자 6자로 생성하므로, 사용자가 소문자로 입력해도 같은 그룹을 찾는 것이 의도에 맞다.

`inviteCode`가 누락되거나 `null`인 경우도 `400 INVITE_CODE_INVALID`로 처리한다. Bean Validation의 `@NotNull`을 쓰면 누락이 `INVALID_REQUEST`가 되는데, 이 코드는 `API-GROUPS-003`의 명시 오류에 없다.

### 5. 탈퇴한 신청자의 가입 요청 처리를 확정한다

`users.withdrawn_at`이 기록된 신청자의 `PENDING_ADMIN` 요청은 다음과 같이 다룬다.

- `API-GROUPS-008` 목록에서 제외한다.
- `API-GROUPS-009`로 처리를 시도하면 `404 JOIN_REQUEST_NOT_FOUND`를 반환한다.

검증 문장: 신청자가 가입 요청 후 탈퇴하면 관리자의 가입 요청 목록에서 사라지고, 그 요청을 승인하려 하면 `404`를 받으며 `group_members` 행이 생기지 않는다.

## 변경 근거

- `API-GROUPS-008`은 `status` 없이도 화면을 그릴 수 있어야 하는데, 필수로 해석하면 관리자가 전체 이력을 한 번에 볼 수 없다. 반대로 임의 값 검증을 생략하면 오타가 빈 목록으로 조용히 처리된다.
- 권한 실패 코드가 세 갈래이면 클라이언트가 같은 「권한 없음」 상황에 세 분기를 유지해야 한다. 특히 `API-GROUPS-007`(구성원)과 `API-GROUPS-008`(관리자)은 같은 그룹 화면에서 연속 호출되는데 실패 코드가 서로 다르다.
- 초대 코드는 사용자가 손으로 옮겨 적는 값이라 대소문자·공백 차이가 실제로 발생한다. 계약에 규칙이 없으면 FE와 BE의 정규화 시점이 어긋난다.
- 5번은 2026-07-29 리뷰에서 발견한 실제 결함에서 나왔다. `UserService.withdraw`는 활성 멤버십만 `left_at` 처리하고 `group_join_requests`의 대기 행은 남긴다. 그래서 「신청 → 본인 탈퇴 → 관리자 승인」 순서를 막지 않으면 `name`·`profile_image_url`이 NULL로 익명화된 계정에 활성 멤버십이 새로 생긴다. 이 유령 구성원은 `API-GROUPS-004`의 인원수 집계와 `API-GROUPS-005` 목록에 이름 없이 나타나고, `CARE_RECEIVER`로 승인되면 `uq_user_active_care_receiver`의 전역 슬롯을 점유한다. 근본 해결은 탈퇴 시 대기 요청을 정리하는 것이지만 그 범위는 `API-USERS-003`이므로, 이번 구현은 조회 시점에 탈퇴 신청자를 제외하는 방식으로 막았다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/JoinRequestService.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/group/JoinRequestApiTest.java`

## 확인된 영향

- 영향 도메인: 그룹·멤버십의 초대 코드 조회, 가입 요청 생성·목록·승인·거절
- 영향 계약: `contracts/API.md` `API-GROUPS-003`·`008`·`009`의 「명시 오류」와 `008`의 핵심 요청 설명. 3번 항목을 채택하면 `API-GROUPS-008`·`009`·`015`의 오류 코드 문자열이 바뀐다. Method, Path, 요청 필드, 성공 결과와 테이블 구성은 변경하지 않는다.
- 영향 화면: 확인 필요. 3번 항목이 채택되면 FE의 권한 오류 분기를 함께 정리해야 한다.
- 검증 범위: `JoinRequestApiTest` 27건에서 소문자 초대 코드 정규화와 누락 처리, `status` 생략·필터·잘못된 값, 비관리자 `NOT_GROUP_MANAGER`, 미인증 `401`, 탈퇴 신청자 제외를 검증했다. 3번 통일안은 미채택 상태이므로 현재 테스트는 갈라진 코드를 그대로 기대한다. 채택 시 테스트와 구현을 함께 바꿔야 한다.

## 확인이 필요한 질문

- 권한 실패 코드를 `FORBIDDEN`으로 통일할지, 역할별 코드로 세분화할지.
- `API-GROUPS-008`의 기본 정렬을 최신순으로 고정할지, 대기 중 요청을 먼저 보일지. 현재 구현은 `created_at` 최신순이다.
- 승인·거절 후 신청자에게 보낼 알림의 트리거 위치. `GROUPS_AND_MEMBERSHIP` 「확정된 동작」 9번은 결과를 앱 내부 알림으로 표시한다고 규정하지만, 알림 생성은 S15P11B104-125 범위여서 이번 구현에는 포함하지 않았다.
- 회원 탈퇴(`API-USERS-003`) 시 해당 사용자의 `PENDING_ADMIN` 가입 요청을 `REJECTED`로 정리할지. 정리하면 5번의 조회 시점 필터가 불필요해진다. 이 질문은 [`CHG-S15P11B104-116-withdrawal-side-effects.md`](./CHG-S15P11B104-116-withdrawal-side-effects.md)의 「탈퇴 시 활성 가입 요청을 어떻게 처리할지」와 같은 결정이며, 두 제안을 함께 판단해야 한다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
