# 보관함 구성원 필터와 API 계약 정합성

- 상태: 승인·반영 완료
- 제안자:
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/contracts/API.md` `API-POSTS-003`, `docs/specs/COVERAGE.md` `REQ-024`·`D-10c`
- 관련 작업: `S15P11B104-208`

## 기존 내용

`docs/specs/domains/FEED_AND_MEDIA.md`의 「확정된 동작」 7번은 보관함에서 구성원·날짜 필터를 사용할 수 있다고 규정한다. `docs/specs/COVERAGE.md`의 `REQ-024`와 `D-10c`도 같은 동작을 보관함 요구사항과 화면 구조에 연결한다.

반면 `docs/specs/contracts/API.md`의 `API-POSTS-003`은 `GET /groups/{groupId}/archive`의 선택 query로 `date`, `type`만 정의한다. 성공 응답 항목도 `postId`, `type`, `thumbnailUrl`, `contentPreview`만 포함해 구성원을 서버에서 필터링하거나 응답을 받은 클라이언트가 구성원별로 구분할 공용 계약이 없다.

현재 백엔드 `PostReadController.getArchive`와 `PostReadService.getArchive`도 `date`, `type`만 처리한다. 프론트엔드 보관함 모델은 fixture의 `memberId`로 구성원 필터를 수행하지만 실제 API 응답과 연결되어 있지 않다.

## 제안 내용

구성원 필터를 유지할지 먼저 결정하고, 승인한 한 가지 방식으로 도메인 스펙과 API 계약을 함께 맞춘다. 승인 전에는 아래 어느 방식도 공식 기준으로 확정하지 않는다.

### A. 서버 필터 방식

- `API-POSTS-003`에 선택 query `memberId`를 추가한다.
- `memberId`를 생략하면 모든 구성원의 게시글을 반환하고, 지정하면 `posts.author_member_id`가 일치하는 게시글만 반환한다.
- `date`, `type`, `memberId`가 함께 오면 모든 조건을 AND로 적용한다.
- 구성원을 바꿀 때 클라이언트가 보관함 API를 다시 호출하며, 응답 항목은 현재 구조를 유지한다.

### B. 클라이언트 필터 방식

- `API-POSTS-003` 성공 응답 항목에 작성자 구성원을 식별할 필드를 추가한다.
- 클라이언트는 한 번 받은 보관함 데이터에서 구성원·날짜 필터를 적용한다.
- 표시 이름이 필요하면 별도 구성원 목록 API를 사용할지, 보관함 응답에 함께 제공할지 계약에 명시한다.

### C. 구성원 필터 제거

- `API-POSTS-003`의 현재 `date`, `type` 계약을 유지한다.
- `FEED_AND_MEDIA.md`, `COVERAGE.md`, 보관함 화면 정의에서 구성원 필터 요구사항을 제거한다.

## 변경 근거

- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/PostReadController.java`의 보관함 API는 `date`, `type`만 받는다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostReadService.java`는 날짜와 미디어 유형만 필터링한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/ArchiveItemResponse.java`에는 작성자 구성원 식별 필드가 없다.
- `frontend/src/features/archive/archiveModel.ts`와 `frontend/src/features/archive/types.ts`는 `memberId`가 있는 로컬 모델을 전제로 필터링한다.
- `docs/spec-changes/pending/`과 `docs/spec-changes/applied/`에는 `API-POSTS-003`의 구성원 필터 계약을 다루는 기존 제안이 없다.

## 확인된 영향

- 영향 도메인: 피드·미디어의 보관함 조회와 구성원별 게시글 탐색
- 영향 계약: `API-POSTS-003` query 또는 성공 응답 구조, `FEED_AND_MEDIA.md` 확정 동작, `COVERAGE.md` 요구사항·화면 매핑
- 영향 화면: 보관함 구성원 필터, 날짜 선택 모달, 빈 상태
- 검증 범위: 결정한 계약의 문서 링크 검사, 백엔드 보관함 API 필터·권한·조합 조건 테스트, 프론트엔드 실제 API 연동과 구성원·날짜 필터 테스트

## 확인이 필요한 질문

- 보관함의 구성원 필터를 제품 요구사항으로 유지할 것인가?
- 유지한다면 서버 필터(A)와 클라이언트 필터(B) 중 어느 방식을 사용할 것인가?
- 구성원 식별자는 `group_members.id`인 `memberId`로 확정할 것인가?
- 탈퇴한 구성원이 작성한 과거 게시글도 필터 선택지와 결과에 포함할 것인가?
- 존재하지 않거나 해당 그룹에 속하지 않은 `memberId`를 빈 결과와 오류 중 무엇으로 처리할 것인가?

## 결정 및 반영

- 결정: A안 전체 승인. `memberId`는 해당 그룹의 활성
  `group_members.id`이며 생략 시 모든 작성자의 보관함 게시글을 반환한다.
  `date`, `type`, `memberId`는 AND로 적용하고 존재하지 않거나 비활성 또는
  다른 그룹의 값은 `400 INVALID_REQUEST`로 거부한다. 탈퇴 구성원의 과거
  게시글은 무필터 결과에 남지만 필터 선택 대상에서는 제외한다.
- 결정자: 사용자(반영 승인), Codex(세부 계약 판단)
- 결정일: 2026-07-31
- 승인 근거: 사용자가 현재 반영되지 않은 불일치를 기록하고 Codex가 세부
  반영 방식을 판단해 `develop`까지 반영하도록 요청했다.
- 반영 문서: `docs/specs/domains/FEED_AND_MEDIA.md`,
  `docs/specs/contracts/API.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
