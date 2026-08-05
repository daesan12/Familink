# 게시글 미디어 요청 URL 상한과 presigned URL 정규화

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-08-05
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` `API-POSTS-004`·`API-POSTS-005`·`API-FILES-001`, `docs/specs/domains/FEED_AND_MEDIA.md`
- 관련 작업: 게시글 수정 시 기존 사진 유지 실패(`size must be between 0 and 500`) 결함 수정
- 관련 제안: [`CHG-20260731-unknown-post-update-thumbnail-contract.md`](../applied/CHG-20260731-unknown-post-update-thumbnail-contract.md), [`CHG-20260730-unknown-media-upload-limits.md`](CHG-20260730-unknown-media-upload-limits.md)

## 기존 내용

- `docs/specs/contracts/API.md` `API-POSTS-004`·`API-POSTS-005`는 미디어
  항목을 `media[{fileUrl,thumbnailUrl?,displayOrder}]`로 정의하지만, 요청
  `fileUrl`·`thumbnailUrl`이 어떤 형태의 URL이어야 하는지(업로드 발급
  응답의 저장용 URL인지, 조회 응답의 presigned 다운로드 URL도 허용되는지)와
  길이 상한은 정의하지 않는다.
- `docs/specs/contracts/API.md` 리포트·카네이션 절 하단은 "DB에는 만료되지
  않는 안정적인 `fileUrl`을 저장한다"고만 정의한다.
- 구현은 작성·수정 모두 `PostMediaRequest`의 `@Size(max = 500)`으로 요청
  URL 길이를 제한했고, 조회 응답(`API-POSTS-001`·`API-POSTS-002`)은 서명
  쿼리가 붙은 presigned 다운로드 URL(통상 500자 초과)을 반환한다.

## 제안 내용

- 게시글 작성·수정 요청의 `media[].fileUrl`·`media[].thumbnailUrl`은
  최대 2,000자까지 허용한다.
- 요청 URL에서 object key를 복원할 수 있으면 서버가 호스트와 경로는
  유지한 채 서명 쿼리만 제거해 만료되지 않는 저장용 URL로 정규화해
  저장한다. 조회 응답의 `fileUrl`·`thumbnailUrl`을 수정 요청에 그대로
  되돌려 보내는 클라이언트 동작을 공식 지원한다.
- DB `post_media.file_url`·`thumbnail_url`에는 기존과 같이 500자 이내의
  canonical URL만 저장한다(스키마 변경 없음).

## 변경 근거

- 결함 재현: 조회 응답의 presigned URL을 수정 요청이 그대로 되돌려 보내면
  `@Size(max = 500)` 검증에 걸려 `400 INVALID_REQUEST`
  (`size must be between 0 and 500`)가 발생한다. 기존 사진을 유지한 채
  게시글을 수정하는 정상 사용 흐름이 항상 실패한다.
  - 프론트 재전송 경로: `frontend/src/features/feed/composer/postComposerModel.ts`
    `createEditInitialValue`, `frontend/src/features/feed/api/postApi.ts`
    `buildMediaRequest`
  - 백엔드 presigned 응답 경로: `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/S3MediaDownloadUrlProvider.java`
- 기존 검증(`S3MediaValidator`·`S3ObjectKeyResolver`)은 이미 URL의 path만
  사용해 object key를 해석하므로 presigned URL도 동일 객체로 검증된다.
  저장만 원본 문자열 그대로 이루어져 계약이 어긋난다.
- 백엔드 수정 반영(사용자 지시로 선반영, 공식 스펙은 미수정):
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostMediaRequest.java`
    `@Size(max = 2000)`
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/S3ObjectKeyResolver.java`
    `normalizePostMediaUrl` (호스트·경로 유지, 서명 쿼리만 제거)
  - `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java`
    저장 전 정규화
  - 검증: `PostApiTest.updateNormalizesPresignedDownloadUrlToCanonicalUrl`,
    `S3ObjectKeyResolverTest`의 정규화 단위 테스트 포함
    `domain.feed`·`domain.file` 테스트 전체 통과(2026-08-05)

## 확인된 영향

- 영향 도메인: 피드·미디어의 게시글 작성·수정
- 영향 계약: `API-POSTS-004`·`API-POSTS-005` 요청 `media[].fileUrl`·
  `media[].thumbnailUrl`의 허용 형태와 길이 상한, 저장 URL 정규화 규칙
- 영향 화면: 게시글 수정에서 기존 사진·영상을 유지하는 흐름
- 검증 범위: 백엔드 통합 테스트(정규화·기존 계약 회귀), 프론트 수정
  화면에서 기존 미디어 유지 수정 E2E(확인 필요)

## 확인이 필요한 질문

- 프로필 이미지(`PATCH /users/me`의 `profileImageUrl`, `@Size(max = 500)`)도
  조회 응답이 presigned URL을 반환하므로 같은 결함이 잠재한다. 같은
  정규화 규칙을 적용할 것인가?
- 요청 URL 상한 2,000자를 계약에 명시할 것인가, 구현 세부로 둘 것인가?

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
