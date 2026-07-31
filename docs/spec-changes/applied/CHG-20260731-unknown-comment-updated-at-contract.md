# 댓글 목록 수정 시각 필드명 정정

- 상태: 승인·반영 완료
- 제안자:
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` `API-COMMENTS-001`
- 관련 작업: `S15P11B104-208`
- 관련 제안: [`CHG-20260731-unknown-list-pagination-contract.md`](./CHG-20260731-unknown-list-pagination-contract.md)

## 기존 내용

`docs/specs/contracts/API.md`의 `API-COMMENTS-001`은 댓글 목록의 성공 응답 항목을 `id`, `author`, `content`, `createdAt`, `updateAt`으로 정의한다.

같은 계약의 `API-COMMENTS-003` 댓글 수정 응답과 다른 수정 시각 필드는 모두 `updatedAt`을 사용한다. 현재 백엔드 `CommentResponse`도 `updatedAt`으로 직렬화하므로, 댓글 목록의 실제 JSON 필드명과 `API-COMMENTS-001` 문서가 일치하지 않는다.

## 제안 내용

- `API-COMMENTS-001` 성공 응답의 `updateAt`을 `updatedAt`으로 정정한다.
- `updatedAt`은 댓글의 마지막 수정 시각이며 ISO-8601 UTC 절대 시각으로 반환한다.
- 런타임 응답 필드는 현재 구현된 `updatedAt`을 유지하고, `updateAt` 별칭은 추가하지 않는다.

검증 문장: 댓글 목록을 조회하면 각 댓글 항목에 `updatedAt`이 존재하고 `updateAt`은 존재하지 않으며, 댓글 수정 후 다시 조회하면 `updatedAt`이 갱신되어 있다.

## 변경 근거

- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/CommentResponse.java`는 `Instant updatedAt`을 정의한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/CommentService.java`는 `comment.getUpdatedAt()`을 `CommentResponse`에 전달한다.
- `backend/src/test/java/com/ssafy/s15p11b104/domain/feed/CommentApiTest.java`는 댓글 목록의 `updatedAt`을 검증한다.
- 같은 API 계약의 `API-COMMENTS-003`도 수정 시각을 `updatedAt`으로 정의한다.
- `docs/spec-changes/pending/`과 `docs/spec-changes/applied/`에는 `API-COMMENTS-001`의 `updateAt` 필드명을 다루는 기존 제안이 없다.

## 확인된 영향

- 영향 도메인: 피드·미디어의 댓글 목록 조회
- 영향 계약: `API-COMMENTS-001` 성공 응답 항목의 필드명
- 영향 화면: 댓글 목록에서 수정 시각을 사용하는 클라이언트
- 검증 범위: 계약 문서 링크 검사, 댓글 목록 직렬화 테스트에서 `updatedAt` 존재 및 `updateAt` 부재 확인, 댓글 수정 후 목록 재조회 테스트

## 확인이 필요한 질문

- 현재 `updateAt`을 기준으로 구현된 클라이언트나 외부 연동이 있는가?
- 없다면 현재 런타임 응답인 `updatedAt`을 공식 계약으로 승인할 것인가?

## 결정 및 반영

- 결정: 전체 승인. 댓글 목록의 수정 시각 필드는 `updatedAt`이며
  `updateAt` 별칭은 제공하지 않는다. 값은 공통 timestamp 계약에 따라
  ISO-8601 UTC 절대 시각으로 반환한다.
- 결정자: 사용자(반영 승인), Codex(세부 계약 판단)
- 결정일: 2026-07-31
- 승인 근거: 사용자가 현재 반영되지 않은 불일치를 기록하고 Codex가 세부
  반영 방식을 판단해 `develop`까지 반영하도록 요청했다.
- 반영 문서: `docs/specs/contracts/API.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
