# [FEED_AND_MEDIA] 피드·미디어·게시글 분석

> 상태: 일부 확정
> 기준: 2026-07-28, 최신 Notion 기술 결정·AI 게시글 분석 설계·API·ERD

## AI 작업 컨텍스트

- 목적: 그룹 구성원이 게시글과 미디어를 공유하고, 내용이 안정된 게시글을 AI가 분석해 피드에서 활용 가능한 요약을 저장한다.
- 포함 범위: 게시글 작성·조회·수정·삭제, 사진·영상, 댓글·반응, 보관함, 게시글 AI 분석.
- 제외 범위: 게시글 분석의 재시도 횟수·백오프와 모델 품질 통과 기준.
- 핵심 경계: Spring Boot가 분석 대상 탐색, Gemini 호출, 결과 저장을 내부 서비스로 수행한다.
- 완료 조건: 공개 API는 [API 계약](../contracts/API.md), 저장 구조는 [DATA_MODEL](../contracts/DATA_MODEL.md)을 따른다.

## 확정된 동작

1. 활성 그룹 구성원은 텍스트 게시글을 작성·조회·수정·삭제할 수 있다.
2. 게시글 본문은 최대 140자다. 미디어는 없거나 사진 1~4장 또는 영상 1개이며 사진과 영상을 함께 첨부하지 않는다.
3. 사진 한 장은 단일 이미지로 표시한다. 사진 2~4장은 `display_order` 순서대로 가로 넘김으로 표시하며 고정 분할하지 않는다.
4. 프론트엔드는 미디어를 최적화해 업로드하고, 제품 DB에는 최적화본 URL만 저장한다. 업로드 원본은 보관하지 않는다.
5. 게시글에는 댓글을 작성·조회·수정·삭제할 수 있다. 대댓글 기능은 현재 범위에 포함하지 않는다.
6. 게시글 반응은 정의된 반응 종류 중 하나만 선택한다. 같은 반응을 다시 선택하면 해제하고 다른 반응을 선택하면 교체한다.
7. 그룹 구성원은 피드와 보관함을 조회하고, 보관함에서 서버가 제공하는
   활성 구성원·날짜·미디어 유형 필터를 사용할 수 있다.
8. Spring Scheduler는 게시글 생성 또는 마지막 수정 후 10분 동안 변경되지 않은 게시글을 분석 대상으로 찾는다.
9. Spring Boot의 `PostAnalysisService`는 분석 상태와 결과 저장을 소유하고
   내부 `PostAnalysisGateway`로 분석을 요청한다. 외부 또는 내부 HTTP 분석
   API는 두지 않는다.
   `PostContentAnalysisService.analyze(postId)`는 `PostAnalysisGateway`를
   구현해 게시글과 `display_order` 오름차순 미디어를 조회하고, 신뢰할 수
   있는 저장소 메타데이터의 MIME을 결합해 Gemini 분석기로 전달한다.
10. 분석 시작 시 `post_analyses.status`를 `PENDING`으로 저장하고, 성공 시
    가족 맥락용 최대 500자의 `summary`와 `SUCCESS`를 저장한다. 원문에 없는
    상황이나 내용을 만들지 않는다.
11. 텍스트 전용 게시글은 `gemini-2.5-flash-lite`를 사용한다. 본문이
    있더라도 이미지 또는 영상이 포함되면 `gemini-3.5-flash`를 우선
    사용한다. `keywords`와 모델·버전 메타데이터는 생성·저장하지 않으며,
    별도 VLM이나 영상 프레임 추출을 사용하지 않는다.
12. 미디어 MIME은 `post_media`에 저장하거나 URL 확장자로 추측하지 않는다.
    내부 `MediaMimeTypeProvider`가 허용된 S3·스토리지 메타데이터의
    `Content-Type`을 제공한다. Provider가 없거나 MIME이 누락·공백이거나
    미디어 종류와 불일치하면 Gemini를 호출하지 않고 `INVALID_INPUT`으로
    처리한다. Provider의 외부 조회 오류는 `UPSTREAM_FAILURE`로 처리한다.
13. 분석 실패 시 `FAILED`를 저장하고 `summary`와 `analyzed_at`은 저장하지 않는다. 다음 안정화 대상 탐색에서의 재처리 정책은 미결정이다.
14. 분석 직전 게시글의 `updated_at`이 대상 선정 시점과 같은지 다시 확인한다. 달라졌거나 게시글이 삭제됐다면 해당 분석을 중단한다.
15. `API-POSTS-004`는 선택된 각 그룹에 독립된 `posts` 행을 만든다. 다중 그룹 게시글의 최종 작성·노출 규칙은 미결정이다.
16. 메인 피드 `D-1`의 게시글 카드에는 작성자와 관계없이 수정·삭제 메뉴를
    표시하지 않는다. 게시글 상세 `D-3`에서는 본인이 작성한 게시글에만
    `···` 메뉴를 표시하고, 선택하면 같은 상세 화면 위에 `D-3-bottom`
    수정·삭제 바텀시트를 표시한다.

## 예외

- 분석 대상 게시글이 삭제됐거나 비어 있으면 분석 레코드를 성공 상태로 만들지 않는다.
- 분석 요청 후 게시글이 수정되면 기존 요청의 결과를 저장하지 않고 새 안정화 구간을 기다린다.
- Gemini 호출이 실패하거나 시간 초과되면 `FAILED`로 기록하고 요약을 비워 둔다.
- 미디어 MIME 입력이 유효하지 않으면 Gemini를 호출하지 않고
  `INVALID_INPUT`으로 처리한다. S3 메타데이터 조회·권한·자격 증명 오류는
  `UPSTREAM_FAILURE`로 처리한다.

## 구현 규칙

- 권한: 해당 그룹의 활성 구성원만 게시글·댓글·반응을 조회하거나 작성할 수 있다. 수정·삭제는 API 계약의 작성자 또는 관리자 규칙을 따른다.
- API:
  - 공개 API는 `API-POSTS-001`~`005`, `API-POSTS-007`, `API-COMMENTS-001`~`004`, `API-REACTIONS-001`, `API-FILES-001`이다.
  - `API-FILES-001`은 `post-media`에 이미지 1~4개 또는 영상 1개만
    허용하고 둘을 섞지 않는다. 이미지 MIME은 `image/jpeg`, `image/png`,
    `image/webp`, 영상 MIME은 `video/mp4`이며 파일당 최대 크기는 각각
    10 MiB와 100 MiB다.
  - 파일 이름은 공백이 아닌 1~255자이며 경로 구분자·제어 문자를 허용하지
    않는다. 크기는 0보다 커야 한다. 서버는 MIME을 정규화해 검증·서명하고,
    클라이언트는 응답의 모든 PUT 헤더를 그대로 사용한다. 서명 만료 시각은
    발급 10분 뒤의 ISO-8601 UTC 절대 시각이다.
  - 피드와 댓글 목록은 `page`, `size` 페이지 query를 사용한다. 피드는
    `createdAt DESC, id DESC`, 댓글은 `createdAt ASC, id ASC`로 정렬을
    고정하며 상세 경계는 [API 계약](../contracts/API.md)을 따른다.
  - 보관함의 `memberId`는 해당 그룹의 활성 `group_members.id`다. 생략하면
    탈퇴 구성원이 작성한 과거 게시글을 포함한 전체 결과를 반환하고, 지정하면
    해당 구성원의 게시글만 반환한다. `date`, `type`, `memberId`는 AND로
    적용하며 존재하지 않거나 비활성 또는 다른 그룹의 `memberId`는
    `400 INVALID_REQUEST`다. 탈퇴 구성원은 필터 선택 대상에는 포함하지 않는다.
  - 게시글 수정의 `media`는 기존 미디어 전체를 교체한다. 미디어 항목의
    `thumbnailUrl`은 선택 값이며 생략하면 해당 썸네일을 `null`로 저장한다.
- 데이터:
  - 관련 엔티티는 `posts`, `post_media`, `comments`, `post_reactions`, `post_analyses`다.
  - 모든 읽기·쓰기는 Spring Boot가 소유한다.
  - 분석 상태와 요약 길이 제약은 [DATA_MODEL](../contracts/DATA_MODEL.md)을 따른다.
- 게시글 분석의 Gemini 요청은 SSAFY GMS 프록시를 사용한다.
  `GMS_API_KEY`는 `x-goog-api-key` 헤더로만 전달하고 URL 쿼리에 넣지 않는다.
  기본 주소는
  `https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com`이며
  `GMS_API_BASE_URL`로 교체할 수 있다. 자동 테스트는 실제 프록시와 키를
  사용하지 않는다.
- 운영 `MediaMimeTypeProvider`는 허용된 S3 URI를 bucket과 object key로
  변환해 `HeadObject`의 `Content-Type`을 사용한다. 기본 AWS S3 URL,
  설정된 path-style endpoint와 명시적으로 허용된 CDN 호스트만 지원하며,
  URL 확장자 추측·파일 바이트 탐지·MIME 캐시·별도 재시도는 하지 않는다.
- 모바일 화면은 React Native로 구현한다. 수정·삭제 메뉴의 화면 위치만
  `D-3` 상세로 제한하며 API 권한, 확인 동작과 후속 콜백 계약은 변경하지
  않는다. 상세 진입 중에도 기존 역할별 하단 탭을 유지한다.

## 인수 조건

### AC-001

- Given: 활성 그룹 구성원이 본문을 입력하고 미디어를 첨부하지 않거나 사진 1~4장 또는 영상 1개를 선택했다.
- When: 게시글을 작성한다.
- Then: 사진과 영상을 함께 포함하지 않는 유효한 게시글이 그룹별 독립 행으로 저장된다.

### AC-002

- Given: 게시글에 이미지가 2장 이상 연결되어 있다.
- When: 게시글을 조회한다.
- Then: 이미지가 `display_order` 순서의 가로 넘김으로 표시된다.

### AC-003

- Given: 게시글이 10분 동안 수정되지 않았다.
- When: Spring Scheduler가 분석 대상을 찾는다.
- Then: Spring Boot가 내부 서비스로 `PENDING` 분석을 시작하고 Gemini 결과를 직접 저장한다.

### AC-004

- Given: 게시글 분석이 성공했다.
- When: 결과를 저장한다.
- Then: 가족 맥락용 최대 500자의 `summary`와 `SUCCESS` 상태가 저장된다.

### AC-005

- Given: 같은 게시글에 같은 반응을 이미 남겼다.
- When: 같은 반응을 다시 선택한다.
- Then: 해당 반응이 해제된다.

### AC-006

- Given: 분석 대상 게시글의 본문과 정렬된 미디어가 조회됐다.
- When: 내부 게시글 분석 서비스를 호출한다.
- Then: 텍스트 전용은 `gemini-2.5-flash-lite`, 미디어 포함은
  `gemini-3.5-flash`를 사용하고, 미디어 MIME이 유효하지 않으면 Gemini를
  호출하지 않는다.

### AC-007

- Given: 메인 피드 또는 게시글 상세 화면에 게시글이 표시됐다.
- When: 사용자가 게시글의 수정·삭제 진입점을 확인한다.
- Then: `D-1`에는 메뉴가 없고, `D-3`의 본인 게시글에만 `···` 메뉴가
  나타나며 선택 시 `D-3-bottom` 바텀시트가 열린다.

### AC-008

- Given: 보관함에서 활성 구성원과 날짜 또는 미디어 유형을 선택했다.
- When: 보관함을 조회한다.
- Then: 서버가 `memberId`, `date`, `type`을 AND로 적용하고, 유효하지 않은
  `memberId`는 `400 INVALID_REQUEST`로 거부한다.

### AC-009

- Given: 작성자가 게시글 수정 요청의 미디어 항목에서 `thumbnailUrl`을
  생략했다.
- When: 수정 요청으로 기존 미디어를 전체 교체한다.
- Then: 해당 미디어의 썸네일은 `null`로 저장된다.

### AC-010

- Given: 사용자가 `post-media` 업로드 URL을 요청한다.
- When: 이미지 1~4개 또는 MP4 영상 1개의 이름·정규화된 MIME·양의 크기를
  제한 안에서 제출한다.
- Then: 서버는 10분 유효한 URL과 PUT에 그대로 사용할 헤더를 반환하며,
  혼합 미디어·개수·MIME·크기·필드 제한 위반은
  `400 INVALID_REQUEST`로 거부한다.

## 미결정 사항

- 게시글 분석 모델의 품질 통과 기준과 대체 모델.
- 분석 실패 시 재시도 횟수·백오프·서버 재시작 후 복구 정책.
- 분석 상태와 결과를 사용자 화면에 직접 노출할지 여부.
- 다중 그룹 게시글의 최종 작성·노출 규칙.
- 영상 최대 재생 시간·허용 코덱, 게시글 저장 전 스토리지 메타데이터
  재검증·FFprobe 사용 여부, 메타데이터 처리와 최적화 임계값.
