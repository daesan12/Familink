# 일정 상세 응답에 작성자 표시 이름 추가

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-08
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-CALENDAR-002`, `domains/CALENDAR.md` 「확정된 동작」 10번
- 관련 작업: S15P11B104-356
- 관련 제안: [`CHG-S15P11B104-116-withdrawal-side-effects.md`](./CHG-S15P11B104-116-withdrawal-side-effects.md)(게시글·댓글의 같은 표시 규칙), [`CHG-S15P11B104-296-calendar-participant-lifecycle.md`](../applied/CHG-S15P11B104-296-calendar-participant-lifecycle.md)(참여자 쪽 `구성원 {ID}` 노출을 해소했고 작성자는 범위 밖으로 두었다)

## 기존 내용

`docs/specs/contracts/API.md:235`의 `API-CALENDAR-002`는 성공 응답을 다음과 같이 정의한다.

> `200`: `id`, `groupId`, `title`, `description`, `eventDate`, `endDate`, `startAt`, `endAt`, `creatorMemberId`, `participantMemberIds`

작성자는 멤버십 ID만 있고 표시 이름이 없다.

`docs/specs/domains/CALENDAR.md:39-40`은 작성자의 **사진** 출처만 규정한다.

> 일정 작성자와 참여자의 사진은 `API-GROUPS-005.profileImageUrl`을 사용하며, 값이 `null`이면 기본 프로필 이미지를 표시한다.

같은 문서 63행은 「상세에는 작성자를 표시하되 생성·수정 화면에는 표시하지 않는다」고 규정한다. 즉 작성자를 표시하라고는 하지만 **이름을 어디서 가져오는지는 어느 문서에도 없다.**

`docs/specs/contracts/API.md:254-257`은 이탈 처리도 `participantMemberIds`에 한정한다.

> `API-CALENDAR-002`의 `participantMemberIds`에는 조회 시점의 활성 그룹 구성원만 포함한다.

## 제안 내용

`API-CALENDAR-002`의 `200` 응답에 `creatorDisplayName`(문자열)을 추가한다.

- 값은 조회자가 등록한 호칭을 반영한 작성자 표시 이름이며 항상 비어 있지 않다.
- 작성자가 회원 탈퇴했으면 조회자의 호칭보다 고정 문구 `탈퇴한 사용자`를 우선한다. 그룹만 나간 작성자는 호칭과 실명을 그대로 유지한다. `API-POSTS-001`·`API-POSTS-002`·`API-COMMENTS-001`의 `author.displayName`과 같은 규칙이다.
- 판별 기준은 `group_members.left_at`이 아니라 `users.withdrawn_at`이다.
- `creatorMemberId`는 클라이언트가 삭제 권한을 판정하는 데 사용하므로 그대로 유지한다.

`domains/CALENDAR.md` 「확정된 동작」 10번을 다음과 같이 보강한다. 작성자의 **이름**은 `API-CALENDAR-002.creatorDisplayName`을 사용하고, **사진**은 기존대로 `API-GROUPS-005.profileImageUrl`을 사용한다. 작성자가 그룹을 나가거나 탈퇴해 활성 구성원 목록에 없어도 이름은 표시되며, 이때 사진은 기본 프로필 이미지가 된다.

검증 문장: 일정 작성자가 그룹을 나간 뒤 다른 활성 구성원이 그 일정 상세를 조회하면 `creatorDisplayName`이 작성자의 실명 또는 조회자가 등록한 호칭이고, 작성자가 회원 탈퇴했으면 호칭을 등록해 두었더라도 `탈퇴한 사용자`다.

## 변경 근거

- `API-GROUPS-005`는 활성 구성원만 반환한다(`GroupMemberService.getMembers` → `findAllActiveByGroupId`, JPQL에 `member.leftAt is null`). 그래서 작성자가 그룹을 나가면 클라이언트가 `creatorMemberId`로 이름을 찾을 수 없다.
- 모바일은 찾지 못한 ID를 `구성원 {ID}`로 표시한다(`frontend/src/features/calendar/components/CalendarEventDetailModal.tsx`). QA S15P11B104-356에서 작성자 자리에 `구성원 6`이 노출되는 것으로 보고됐다. 같은 문구가 참여자 쪽에서 「남지 않아야 한다」고 이미 판정됐다(`CHG-S15P11B104-296`).
- 데이터는 남아 있다. 그룹 나가기는 `left_at`만 기록하는 soft delete이고 `users.name`을 지우지 않으므로(`GroupMember.leave`, `User.withdraw` 비교) 서버는 이름을 해석할 수 있다.
- 게시글·댓글은 이미 서버가 `User.resolveDisplayName()`으로 해석해 내려주고 있다(`PostReadService`, `CommentService`). 일정만 클라이언트 조인에 의존하는 것이 불일치이며, 이 때문에 같은 사용자가 화면에 따라 다른 이름으로 보인다.
- 검토한 대안: (a) `API-GROUPS-005`가 이탈 구성원도 반환하게 한다 — 이 목록은 참여자 선택·권한 판정 등 다른 화면이 「활성 구성원」으로 의존하므로 계약이 깨진다. (b) 이름 조회 API를 따로 만든다 — 상세를 열 때마다 요청이 늘고 서버가 이미 가진 값을 다시 왕복한다. 서버가 상세 응답에 함께 담는 것이 가장 단순하다.
- 필드 추가이므로 구버전 앱은 영향을 받지 않는다. 반대 방향(신버전 앱 + 구버전 서버)에서는 앱 빌드가 `main` 브랜치에서 배포되는 서버를 바라보므로, 이 제안이 `develop`에만 머지된 시점에는 값이 오지 않는다. 그래서 앱은 `creatorDisplayName`을 선택 값으로 파싱해 없으면 기존 동작으로 물러나게 했고, 값이 있는데 형식이 깨진 경우만 거부한다. 두 동작 모두 테스트로 고정했다.
- 조회자 호칭을 서버가 반영해야 하는 이유: 현재 화면이 쓰는 `API-GROUPS-005.displayName`은 이미 호칭이 적용된 값이다(`GroupMemberService`의 `aliasesByTarget`). 서버가 실명만 내려주면 호칭을 등록한 활성 작성자의 표시가 호칭에서 실명으로 되돌아가는 회귀가 생긴다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/calendar/dto/CalendarEventDetailResponse.java`, 같은 도메인 `service/CalendarEventService.java`의 `getEvent()`와 `resolveCreatorDisplayName()`, `backend/src/test/java/com/ssafy/s15p11b104/domain/calendar/CalendarEventApiTest.java`의 `creatorWhoOnlyLeftGroupKeepsRealName`·`withdrawnCreatorIsDisplayedWithFallbackNameIgnoringViewerAlias`·`creatorDisplayNameUsesViewerAlias`, `frontend/src/features/calendar/api/calendarApi.ts`, `frontend/src/features/calendar/components/CalendarEventDetailModal.tsx`, `frontend/src/features/calendar/screens/CalendarScreen.test.tsx`의 "그룹을 나간 작성자도 서버가 준 이름으로 표시한다"

## 확인된 영향

- 영향 도메인: 일정·캘린더의 상세 조회
- 영향 계약: `contracts/API.md` `API-CALENDAR-002`의 `200` 응답에 `creatorDisplayName`을 추가한다. Method, Path, 요청 형식, 오류 코드는 변경하지 않는다. `API-CALENDAR-001`·`003`·`004`·`005`와 `contracts/DATA_MODEL.md`는 변경하지 않는다.
- 영향 화면: 일정 상세 `E-2p`. 생성·수정 `E-3`은 작성자를 표시하지 않으므로 영향이 없다.
- 검증 범위: 백엔드 `CalendarEventApiTest`에서 활성 작성자·호칭 적용·그룹 이탈 작성자·회원 탈퇴 작성자 네 경우를 확인했다(51개 테스트 통과). 프론트는 파싱 계층에서 정상 값·필드 누락·형식 위반 세 경우를, 화면에서 이탈 작성자 표시를 각각 테스트로 고정했다. 화면 테스트는 수정 전 코드에서 실패하는 것을 확인했다.

## 확인이 필요한 질문

- 그룹을 나간 작성자의 프로필 **사진**도 서버가 함께 내려줄지. 이번 범위에서는 손대지 않았고 기본 프로필 이미지로 표시된다. 회원 탈퇴한 작성자는 `User.withdraw`가 `profile_image_url`을 지우므로 애초에 보여줄 사진이 없다. 살리려면 상세 조회마다 presigned URL 발급이 추가되고 `CALENDAR.md:39-40`의 사진 출처 규정도 함께 바뀌어야 한다.
- `API-CALENDAR-004`의 `lastEditorMemberId`에도 같은 공백이 있는지. 현재 앱은 최종 수정자를 화면에 표시하지 않아 증상이 드러나지 않으므로 이번 범위에 넣지 않았다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
