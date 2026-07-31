# 목록 API 페이지 query 공통 계약 확정

- 상태: 승인·반영 완료
- 제안자:
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` 「공통 경계」, `API-POSTS-001`, `API-COMMENTS-001`, `API-NOTIFICATIONS-003`
- 관련 작업: `S15P11B104-208`
- 관련 제안: [`CHG-20260731-unknown-comment-updated-at-contract.md`](./CHG-20260731-unknown-comment-updated-at-contract.md)

## 기존 내용

`docs/specs/contracts/API.md`는 제품 구현에서 사용하는 유일한 로컬 API 계약이라고 선언한다. 그러나 `API-POSTS-001`, `API-COMMENTS-001`, `API-NOTIFICATIONS-003`의 요청은 query 필드 대신 `원본의 페이지 query`라고만 적혀 있다.

따라서 로컬 계약만으로는 페이지 번호와 크기의 필드명, 0부터 시작하는지 여부, 기본값·최댓값, 정렬 허용 여부와 잘못된 값의 오류를 알 수 없다. `API-COMMENTS-001` 성공 결과에는 다른 두 목록 API와 달리 다음 페이지 존재 여부도 적혀 있지 않다.

현재 구현된 게시글·댓글 목록 API는 Spring `Pageable`을 사용하고 기본 `size`를 20으로 둔다. 게시글은 생성 시각 내림차순, 댓글은 생성 시각 오름차순으로 조회하며 응답에 `hasNext`를 반환한다. 알림 목록 API는 아직 구현되지 않아 이 항목의 구현 누락은 별도 `IMPLEMENTATION_GAP`이다.

## 제안 내용

세 목록 API가 외부 원본 없이 구현될 수 있도록 다음 항목을 `API.md`의 공통 페이지네이션 계약과 각 API 행에 명시한다.

- query 필드명은 `page`, `size`로 통일한다.
- `page`는 0부터 시작하며 생략 시 0을 사용한다.
- `size`는 생략 시 20을 사용한다.
- 성공 응답은 `content[]`, `hasNext`를 포함한다.
- 게시글은 `createdAt` 내림차순, 댓글은 `createdAt` 오름차순으로 고정한다.
- 알림 목록의 정렬 방향, 허용 가능한 최대 `size`, `sort` query 지원 여부와 잘못된 값의 오류는 아래 질문을 결정한 뒤 함께 확정한다.

검증 문장: `page`와 `size`를 생략하면 첫 20개와 `hasNext`를 반환하고, `page=1&size=1`은 두 번째 항목 한 개를 반환하며, 각 API는 계약에 적힌 고정 정렬을 유지한다.

## 변경 근거

- 외부의 “원본”을 보지 않으면 공개 API query를 구성할 수 없어 로컬 스펙만으로 구현할 수 있다는 저장소 원칙을 충족하지 못한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/PostReadController.java`와 `CommentController.java`는 `@PageableDefault(size = 20)`을 사용한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/repository/PostRepository.java`는 게시글을 생성 시각 내림차순으로, `CommentRepository.java`는 댓글을 생성 시각 오름차순으로 조회한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostListResponse.java`와 `CommentListResponse.java`는 `hasNext`를 반환한다.
- `backend/src/test/java/com/ssafy/s15p11b104/domain/feed/CommentApiTest.java`는 `size` query와 `hasNext`를 검증한다.
- `docs/spec-changes/pending/`과 `docs/spec-changes/applied/`에는 세 API의 페이지 query 공통 계약을 다루는 기존 제안이 없다.

## 확인된 영향

- 영향 도메인: 피드 목록, 댓글 목록, 알림 목록 조회
- 영향 계약: 공통 페이지 query와 `API-POSTS-001`, `API-COMMENTS-001`, `API-NOTIFICATIONS-003`의 요청·성공 응답
- 영향 화면: 무한 스크롤 또는 다음 페이지를 사용하는 피드·댓글·알림 화면
- 검증 범위: 계약 문서 링크 검사, 기본값·페이지 이동·고정 정렬·최대 크기·잘못된 query 테스트, 프론트엔드 목록 API 어댑터 테스트

## 확인이 필요한 질문

- `size`의 최댓값을 얼마로 제한할 것인가?
- 클라이언트가 `sort` query를 보낼 수 있게 할 것인가, API별 고정 정렬만 허용할 것인가?
- 알림 목록은 `createdAt` 내림차순으로 확정할 것인가?
- 음수 `page`, 0 이하 또는 최댓값 초과 `size`, 허용하지 않은 `sort`를 모두 `400 INVALID_REQUEST`로 처리할 것인가?

## 결정 및 반영

- 결정: 전체 승인. `page`는 0부터 시작하고 기본값은 `0`, `size`의 기본값은
  `20`, 허용 범위는 `1`~`100`이다. 공개 `sort` query는 지원하지 않는다.
  게시글은 `createdAt DESC, id DESC`, 댓글은 `createdAt ASC, id ASC`,
  알림은 `createdAt DESC, id DESC`로 고정한다. 잘못된 `page`, `size` 또는
  `sort`는 `400 INVALID_REQUEST`이며 성공 결과는 `content[]`, `hasNext`다.
- 결정자: 사용자(반영 승인), Codex(세부 계약 판단)
- 결정일: 2026-07-31
- 승인 근거: 사용자가 현재 반영되지 않은 불일치를 기록하고 Codex가 세부
  반영 방식을 판단해 `develop`까지 반영하도록 요청했다.
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
