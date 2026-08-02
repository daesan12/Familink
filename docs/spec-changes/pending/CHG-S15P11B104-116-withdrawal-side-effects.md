# 회원 탈퇴의 부수효과 확정

- 상태: 제안
- 제안자: 이경호
- 작성일: 2026-07-29
- 차단 변경: 아니오
- 영향 스펙·계약: `domains/ACCOUNT_AND_PROFILE.md` 「확정된 동작」 8번, `contracts/API.md` `API-USERS-003`, `contracts/DATA_MODEL.md` `group_members`·탈퇴 정책, `COMMON.md` 「인증과 요청 경계」의 블랙리스트 키와 인증 필터 규정. 미결 질문 1번은 `contracts/API.md` `API-GROUPS-013`과 `domains/GROUPS_AND_MEMBERSHIP.md` 「확정된 동작」 10·11번에도 걸친다.
- 관련 작업: S15P11B104-116, S15P11B104-120(미결 질문 1번 보강), S15P11B104-194(사용자 단위 차단 구현)
- 관련 제안: [`CHG-S15P11B104-114-auth-token-storage-and-ttl.md`](./CHG-S15P11B104-114-auth-token-storage-and-ttl.md), [`CHG-S15P11B104-116-profile-partial-update.md`](./CHG-S15P11B104-116-profile-partial-update.md)

## 기존 내용

`docs/specs/domains/ACCOUNT_AND_PROFILE.md` 「확정된 동작」 8번은 익명화 대상 컬럼만 규정한다.

> 사용자가 탈퇴하면 `login_id`, `password_hash`, `name`, `birth_date`, `gender`, `profile_image_url`을 NULL로 익명화하고 `withdrawn_at`을 기록한다. 작성 기록과 과거 그룹 관계는 보존하며 기존 계정은 복구하지 않는다.

`docs/specs/contracts/API.md` 43~45행의 `API-USERS-003`은 `409 MANAGER_TRANSFER_REQUIRED`를 명시 오류로 열거하지만 이 오류가 발생하는 조건은 적지 않는다. `docs/specs/contracts/DATA_MODEL.md` 「탈퇴 정책」 282행도 익명화와 기록 보존만 규정한다.

즉 로컬 스펙에는 다음 세 가지가 없다.

- 탈퇴 시점에 아직 활성인 `group_members` 행을 어떻게 처리하는지
- 탈퇴 시 발급된 토큰을 어떻게 처리하는지
- `MANAGER_TRANSFER_REQUIRED`가 어떤 조건에서 발생하는지

## 제안 내용

팀 Notion 「API 명세서 2차 수정본」의 `API-USERS-003`(회원 탈퇴) 「처리 규칙」에 이미 확정되어 있는 다음 내용을 로컬 스펙에 반영한다. 결정 대상이 아니라 로컬 스펙 누락분이다.

- **활성 그룹 구성원 자격을 함께 종료한다.** 탈퇴하는 사용자의 모든 활성 `group_members`(`left_at IS NULL`)에 `left_at`을 기록한다. 행을 삭제하지 않으므로 과거 그룹 관계는 그대로 보존된다.
- **Refresh Token을 폐기한다.** `refresh:{userId}` 키를 삭제한다.
- **활성 그룹의 관리자는 먼저 권한을 위임해야 한다.** 탈퇴 요청자가 활성 상태로 `is_manager = true`인 멤버십을 하나라도 가지고 있으면 `409 MANAGER_TRANSFER_REQUIRED`를 반환하고 익명화·멤버십 종료·토큰 폐기를 모두 수행하지 않는다. 오류 문구는 `다른 활성 구성원에게 관리자 권한을 위임한 후 탈퇴해야 함`이다.

Notion에도 정의되지 않아 이번 구현에서 판단한 사항은 다음 둘이다.

- **요청에 사용된 Access Token을 남은 만료 시간만큼 블랙리스트에 등록한다.** `blacklist:{accessToken}` 키를 사용하며 로그아웃(`API-AUTH-005`)과 같은 방식이다.
- **사용자 단위 차단 키를 추가한다.** 2026-07-30 보강. 탈퇴 시 `blacklist:user:{userId}` 키를 `withdrawn` 값과 Access Token 유효 기간(기본 30분) TTL로 저장하고, 인증 필터는 서명·만료 검증 후 토큰 단위 키와 사용자 단위 키를 모두 확인한다. 토큰 단위 키만으로는 재발급으로 이미 받아 둔 다른 Access Token을 막을 수 없다. 탈퇴 후에는 로그인과 재발급이 모두 막히므로 이 TTL이 끝나는 시점에는 유효한 토큰이 남지 않는다. 이 방식은 계정 상태를 매 요청 조회하지 않아 인증 경로에 DB 조회를 더하지 않는다.

검증 문장: 활성 그룹의 비관리자 구성원이 탈퇴를 요청하면 `204`를 받고, `users`의 익명화 대상 6개 컬럼이 NULL이며 `withdrawn_at`이 기록되고, 해당 사용자의 모든 `group_members`에 `left_at`이 기록되며, 같은 Access Token으로 보호 API를 호출하면 `401 UNAUTHORIZED`, 같은 Refresh Token으로 재발급을 요청하면 `401 INVALID_REFRESH_TOKEN`을 받는다. `API-AUTH-004` 재발급으로 받은 새 Access Token으로 탈퇴한 경우에도, 재발급 이전에 쓰던 Access Token으로 계정 상태를 재확인하지 않는 보호 API(`API-FILES-001` 업로드 URL 발급)를 호출하면 `401 UNAUTHORIZED`를 받는다. 활성 그룹의 관리자가 탈퇴를 요청하면 `409 MANAGER_TRANSFER_REQUIRED`를 받고 계정·멤버십·토큰이 모두 그대로 유지된다.

## 변경 근거

- 활성 멤버십을 남겨 두면 익명화된 사용자가 `API-GROUPS-005`의 활성 구성원 목록과 `API-GROUPS-004`의 `memberCount`·`guardianCount`·`careReceiverCount`에 이름이 NULL인 상태로 계속 집계된다. 또 탈퇴자가 피보호자였다면 `uq_user_active_care_receiver` 부분 Unique 인덱스의 자리를 계속 점유하고, `API-GROUPS-014` 그룹 삭제의 `409 GROUP_HAS_ACTIVE_MEMBERS` 판정에도 계속 포함된다.
- Access Token은 자체 검증 JWT이므로 탈퇴 후에도 만료 전까지 유효하다. 프로필 API는 `withdrawn_at IS NULL` 조건으로 활성 계정을 조회해 `401`을 반환하지만, 이 조건을 검사하지 않는 다른 API는 탈퇴한 사용자의 요청을 최대 30분 동안 계속 처리한다. 블랙리스트 등록은 이 창을 닫는 최소 조치이며 로그아웃에서 이미 사용하는 메커니즘을 그대로 재사용한다.
- 2026-07-29 백엔드 담당자가 활성 멤버십에 `left_at`을 기록하는 방향을 결정했고, 이후 Notion 확정 명세에서 같은 규칙이 확인되었다.
- `CHG-S15P11B104-114-auth-token-storage-and-ttl.md`의 확인 질문 「회원 탈퇴 시 해당 사용자의 Refresh Token을 함께 폐기해야 하는지」는 이 제안으로 해소된다. 폐기한다. 해당 제안의 2026-07-29 일부 승인도 "회원 탈퇴 시 토큰 폐기는 미구현·미확정이므로 승인 범위에서 제외하고 보류"했으므로, 이 제안이 그 보류분을 채운다.
- 2026-07-30 보강: 위 「최소 조치」가 실제로는 부족했다. 토큰 단위 차단만으로는 재발급 이전 Access Token이 남아, 계정 상태를 재확인하지 않는 `API-FILES-001`에서 탈퇴 계정의 권한이 유지됐다. 사용자 단위 차단 키로 이 창을 닫았다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/UserService.java`, `backend/src/main/java/com/ssafy/s15p11b104/global/security/AccessTokenBlacklist.java`, `backend/src/main/java/com/ssafy/s15p11b104/global/security/JwtAuthenticationFilter.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/account/UserApiTest.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/account/WithdrawalTokenRevocationTest.java`

## 확인된 영향

- 영향 도메인: 계정·프로필의 탈퇴, 그룹·구성원의 활성 구성원 집계
- 영향 계약: `contracts/API.md` `API-USERS-003`에 처리 규칙과 `MANAGER_TRANSFER_REQUIRED` 발생 조건을 추가한다. `domains/ACCOUNT_AND_PROFILE.md` 「확정된 동작」 8번에 활성 멤버십 종료와 토큰 폐기를 추가한다. `contracts/DATA_MODEL.md` 「탈퇴 정책」에 `group_members.left_at` 기록을 추가한다. `COMMON.md` 「인증과 요청 경계」의 블랙리스트 규정에 사용자 단위 키 `blacklist:user:{userId}`와 인증 필터의 두 단계 확인을 추가한다. Method, Path, 요청·응답 형식과 테이블 구성은 변경하지 않는다.
- 영향 화면: 확인 필요. 프로필 화면의 탈퇴 흐름에서 관리자인 사용자에게 「관리자 권한을 먼저 위임해야 한다」는 안내가 필요하다. Notion의 화면·이벤트 매핑에도 호출 조건이 「관리자 그룹 처리 조건 충족」으로 적혀 있다.
- 검증 범위: `UserApiTest`에서 익명화 6개 컬럼, `withdrawn_at`, `left_at` 기록, Access Token 차단, Refresh Token 폐기, 로그인 ID 재사용 가능, 관리자 `409`와 비관리자 성공을 검증했다. `WithdrawalTokenRevocationTest`에서 재발급 이전 Access Token이 `API-FILES-001`을 호출하지 못하는 것을 검증했다. 활성 구성원 목록·인원수 API는 아직 구현되지 않아 실제 집계 영향은 해당 API 구현 시점에 확인해야 한다.

## 확인이 필요한 질문

- 그룹의 유일한 활성 구성원인 관리자는 위임할 대상이 없어 탈퇴할 수 없다. 이 경우 그룹을 먼저 삭제(`API-GROUPS-014`)하도록 안내할지, 아니면 마지막 구성원의 탈퇴는 그룹 삭제를 함께 수행할지 결정이 필요하다. 현재 구현은 Notion 규칙을 문자 그대로 적용해 `409 MANAGER_TRANSFER_REQUIRED`를 반환한다.
  - 2026-07-30 보강(S15P11B104-120): 같은 결정이 그룹 탈퇴 `API-GROUPS-013`에도 그대로 적용된다. 이 계약의 「명시 오류」에도 `409 MANAGER_TRANSFER_REQUIRED` 하나만 정의되어 있어, `domains/GROUPS_AND_MEMBERSHIP.md` 「확정된 동작」 10번(다른 구성원이 있으면 먼저 위임)과 11번(관리자가 혼자면 그룹 삭제 확인으로 연결)이 서로 다른 후속 화면을 요구하는데도 서버 응답이 구분되지 않는다. 현재 구현(`GroupService.leave`)은 두 경우 모두 `409 MANAGER_TRANSFER_REQUIRED`를 반환하며, 계약이 이 엔드포인트에 허용한 유일한 `409`이므로 계약 위반은 아니다. 클라이언트는 `API-GROUPS-004`의 `memberCount`로 단독 여부를 판별할 수 있어 흐름이 막히지는 않는다. 결정이 필요한 것은 두 경우에 서로 다른 오류 코드를 둘지, 아니면 단일 코드를 유지하고 분기를 클라이언트에 맡길지이며, 이는 회원 탈퇴 경로와 같은 결정으로 함께 판단해야 한다. 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java`의 `leave()`, `backend/src/test/java/com/ssafy/s15p11b104/domain/group/GroupApiTest.java`의 `managerCannotLeaveBeforeTransferringManagerRole`·`soleManagerCannotLeaveEither`.
- 탈퇴한 사용자가 남긴 게시글·댓글의 작성자를 화면에 어떻게 표시할지. 2026-07-29 백엔드 담당자가 확인한 의도는 「탈퇴한 사용자」와 기본 프로필 이미지를 표시하는 것이다. 이때 판별 기준은 `group_members.left_at`이 아니라 `users.withdrawn_at`이어야 한다. 그룹만 나간 사용자는 `users`의 이름·프로필이 그대로 남아 있어 기존처럼 표시되지만, 탈퇴한 사용자는 이름이 NULL이므로 `left_at`만 확인하는 로직은 빈 이름을 노출한다. 이 표시 규칙은 피드 API를 구현하는 작업에서 확정해야 한다.
- 탈퇴 시 활성 `group_join_requests`(`PENDING_ADMIN`)를 어떻게 처리할지. Notion과 로컬 스펙 모두 정의하지 않으며, 이번 범위에서는 손대지 않았다.
- 사용자 단위 차단 키(`blacklist:user:{userId}`)를 확정 설계로 받아들일지. 2026-07-30에 이 잔여 위험이 실제 취약점으로 확인되어 위 「제안 내용」의 두 번째 항목으로 구현했고, 남은 것은 키 설계 승인이다.
  - 최초 기록에서 「현재 구현된 API 중에는 해당 경로가 없다」고 판단했으나 이 서술은 더 이상 맞지 않는다. 이후 추가된 `API-FILES-001`(`FileUploadService.issue`)은 인증 주체의 ID를 받기만 하고 계정 활성 여부도, 그룹 멤버십도 확인하지 않는다. 재발급 이전 Access Token으로 이 API를 호출하면 탈퇴한 계정이 최대 30분 동안 업로드 URL을 계속 발급받을 수 있었다. 수정 전 코드에서 이 경로가 `201`을 반환하는 것을 테스트로 확인했다.
  - 검토했던 두 방법 중 사용자 단위 Redis 키를 택했다. 인증 필터에서 계정 활성 여부를 확인하는 방법은 모든 인증 요청에 DB 조회를 더하지만, 사용자 단위 키는 이미 수행하는 Redis 조회를 한 번 늘리는 데 그친다. 대신 `COMMON.md`가 규정한 「로그아웃한 Access Token만 블랙리스트에 저장」과 「인증 필터는 서명·만료 검증 후 블랙리스트를 확인한다」는 문장이 달라져야 하므로 승인이 필요하다.
  - 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/global/security/AccessTokenBlacklist.java`, `backend/src/main/java/com/ssafy/s15p11b104/global/security/JwtAuthenticationFilter.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/account/WithdrawalTokenRevocationTest.java`
- `API-FILES-001`이 계정 활성 여부와 그룹 멤버십을 전혀 확인하지 않는 것이 의도인지. 사용자 단위 차단으로 탈퇴 경로는 막혔지만, 이 API는 여전히 인증만 통과하면 누구나 업로드 URL을 받는다. 계약의 대상이 「Access Token 로그인 사용자」로만 적혀 있어 현재 구현이 계약 위반은 아니며, 이번 범위에서는 손대지 않았다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
