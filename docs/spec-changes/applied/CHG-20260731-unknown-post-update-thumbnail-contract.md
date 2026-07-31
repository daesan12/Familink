# 게시글 수정 미디어 썸네일 요청 계약 정합성

- 상태: 승인·반영 완료
- 제안자:
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` `API-POSTS-004`·`API-POSTS-005`, `docs/specs/domains/FEED_AND_MEDIA.md`
- 관련 작업: `S15P11B104-208`
- 관련 제안: [`CHG-20260730-unknown-media-upload-limits.md`](../pending/CHG-20260730-unknown-media-upload-limits.md)

## 기존 내용

`docs/specs/contracts/API.md`의 `API-POSTS-004` 게시글 작성 요청은 미디어 항목을 `fileUrl`, `thumbnailUrl`, `displayOrder`로 정의한다. 반면 `API-POSTS-005` 게시글 수정 요청은 같은 미디어 항목에서 `thumbnailUrl`을 제외하고 `fileUrl`, `displayOrder`만 적고 있다.

현재 백엔드는 작성과 수정에 같은 `PostMediaRequest`를 사용하며 두 요청 모두 선택 필드 `thumbnailUrl`을 받는다. 게시글 수정 서비스도 전달된 썸네일 URL을 검증하고 기존 미디어를 새 요청 값으로 교체한다. 따라서 수정 API가 `thumbnailUrl`을 공식 지원하는지, 문서에 적히지 않은 필드를 구현이 추가로 허용하는지 공용 계약이 불명확하다.

## 제안 내용

다음 두 방식 중 하나를 승인해 수정 요청 계약과 구현을 맞춘다. 승인 전에는 어느 방식도 공식 기준으로 확정하지 않는다.

### A. 게시글 수정에서도 썸네일을 지원

- `API-POSTS-005`의 미디어 항목을 `media[{fileUrl,thumbnailUrl?,displayOrder}]`로 정정한다.
- `thumbnailUrl`의 형식, 허용 저장소와 검증 규칙은 `API-POSTS-004`와 동일하게 적용한다.
- 수정 요청은 미디어 전체 교체 방식으로 처리하며, `thumbnailUrl`을 생략하면 해당 미디어의 썸네일을 `null`로 저장한다.

### B. 게시글 수정에서는 썸네일을 받지 않음

- `API-POSTS-005`의 현재 계약을 유지한다.
- 백엔드 수정 요청 DTO에서 `thumbnailUrl`을 허용하지 않고, 영상 썸네일을 유지·재생성·삭제하는 방식을 별도로 확정한다.

## 변경 근거

- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostCreateRequest.java`와 `PostUpdateRequest.java`는 모두 `PostMediaRequest`를 사용한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostMediaRequest.java`는 선택 필드 `thumbnailUrl`을 정의한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java`는 게시글 수정에서도 `thumbnailUrl`을 검증하고 `PostMedia`에 저장한다.
- 기존 `CHG-20260730-unknown-media-upload-limits.md`는 파일 크기·MIME·영상 길이 제한을 다루며, 수정 API의 `thumbnailUrl` 허용 여부는 다루지 않는다.
- 그 밖의 `docs/spec-changes/pending/`과 `docs/spec-changes/applied/`에는 이 요청 필드 차이를 다루는 제안이 없다.

## 확인된 영향

- 영향 도메인: 피드·미디어의 게시글 수정과 영상 썸네일
- 영향 계약: `API-POSTS-005` 미디어 요청 항목과 `API-POSTS-004`와의 공통 구조
- 영향 화면: 게시글 수정에서 영상 또는 썸네일을 교체·삭제하는 화면(구현 여부 확인 필요)
- 검증 범위: 계약 문서 링크 검사, 게시글 수정의 썸네일 포함·생략·잘못된 URL 요청 테스트, 수정 후 게시글 상세 응답의 썸네일 확인

## 확인이 필요한 질문

- 게시글 수정에서도 `thumbnailUrl`을 공식 지원할 것인가?
- 전체 교체 요청에서 `thumbnailUrl`을 생략하면 기존 값을 유지할지, `null`로 제거할지?
- 영상 썸네일을 클라이언트가 전달할지, 서버가 생성할지?

## 결정 및 반영

- 결정: A안 전체 승인. 게시글 수정에서도 미디어 항목의 선택 필드
  `thumbnailUrl`을 지원한다. 수정 요청의 `media`는 기존 미디어 전체를
  교체하며, 항목에서 `thumbnailUrl`을 생략하면 해당 썸네일을 `null`로
  저장한다.
- 결정자: 사용자(반영 승인), Codex(세부 계약 판단)
- 결정일: 2026-07-31
- 승인 근거: 사용자가 현재 반영되지 않은 불일치를 기록하고 Codex가 세부
  반영 방식을 판단해 `develop`까지 반영하도록 요청했다.
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/domains/FEED_AND_MEDIA.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
