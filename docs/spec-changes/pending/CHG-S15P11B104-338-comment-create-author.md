# 댓글 생성 응답에 작성자 정보 추가

- 상태: 제안
- 제안자: 이경호
- 작성일: 2026-08-07
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-COMMENTS-002`
- 관련 작업: S15P11B104-338

## 기존 내용

`docs/specs/contracts/API.md:186`의 `API-COMMENTS-002`는 댓글 생성 성공 응답을 다음과 같이 정의한다.

> `201`: `id`, `postId`, `content`, `createdAt`

같은 문서 185행의 `API-COMMENTS-001`(댓글 목록)은 `content[{id,author,content,createdAt,updatedAt}]`으로 `author`를 포함한다. 즉 목록에는 작성자가 있고 생성 응답에는 없다.

서버 구현은 계약과 정확히 일치한다(`backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/CommentCreateResponse.java`).

## 제안 내용

`API-COMMENTS-002`의 `201` 응답에 `author`를 추가한다. 형식은 `API-COMMENTS-001`의 `author`와 동일한 `PostAuthorResponse`(`memberId`, `userId`, `displayName`, `profileImageUrl`, `role`)다.

`displayName`은 조회자의 호칭을 적용하지 않고 작성자 본인의 표시 이름을 사용한다. 이 경로에서는 조회자와 작성자가 같은 사람이고, 자기 자신에게는 호칭을 등록할 수 없기 때문이다(`CHG-20260730-rudgh8182-member-alias-self-alias-check` 적용됨).

검증 문장: 프로필 사진이 있는 활성 구성원이 댓글을 작성하면 `201` 응답의 `author.profileImageUrl`에 목록 조회와 동일한 서명 URL이 담기고, 클라이언트는 목록을 다시 조회하지 않고도 새 댓글의 작성자 아바타를 그릴 수 있다.

## 변경 근거

- 프로필 이미지 URL은 S3 presigned 서명 URL이다(`S3MediaDownloadUrlProvider.issueProfileImageDownloadUrl`, 기본 유효기간 30분). 서명 키가 서버 비밀값이므로 **클라이언트가 자체적으로 만들 수 없다.**
- 현재 앱은 댓글을 낙관적으로 추가한 뒤 생성 응답으로 교체하는데, 작성자만은 화면이 들고 있는 `currentUser`로 채운다(`frontend/src/features/feed/screens/FeedScreen.tsx`의 `handleCreateComment`). 이 객체는 `frontend/App.tsx`에서 이름과 이니셜만으로 만들어져 `profileImageUrl`이 없다. 앱 셸의 `AppScreenProps`에도 해당 필드가 없다.
- 결과적으로 방금 작성한 댓글만 기본 프로필 이미지로 보이고, 목록을 다시 조회해야 실제 사진이 나타난다(QA S15P11B104-338).
- 대안으로 (a) 생성 후 첫 페이지 재조회, (b) 앱 셸이 `/users/me`의 프로필 이미지를 보유하는 방법을 검토했다. (a)는 댓글마다 요청이 하나 늘고 이미 불러온 뒤 페이지가 1페이지로 접히며, (b)는 조회 시점·상태 수명·서명 URL 만료를 새로 관리해야 한다. 서버가 이미 목록에서 만들고 있는 값을 생성 응답에 함께 담는 것이 가장 단순하다.
- 필드 추가이므로 구버전 앱은 영향을 받지 않는다. 앱 파서는 모르는 필드를 무시한다.
- 반대 방향(신버전 앱 + 구버전 서버)에는 주의가 필요하다. 앱 빌드는 `frontend/.env.*`가 가리키는 `https://api.familink360.com`을 사용하고 그 서버는 `Jenkinsfile`상 `main` 브랜치에서만 배포된다. 이 제안이 `develop`에만 머지된 시점에 앱을 배포하면 서버는 아직 `author`를 내려주지 않는다. 그래서 앱은 `author`를 **선택 값**으로 두고, 없으면 기존처럼 화면이 들고 있는 사용자로 채워 댓글 작성 자체는 정상 동작하게 했다. 값이 있는데 형식이 깨진 경우만 거부한다. 두 동작 모두 테스트로 고정했다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/CommentCreateResponse.java`, `backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/CommentService.java`의 `create()`, `backend/src/test/java/com/ssafy/s15p11b104/domain/feed/CommentApiTest.java`의 `activeMemberCanListAndCreateComments`, `frontend/src/features/feed/api/commentApi.ts`의 `parseCreatedComment`, `frontend/src/features/feed/screens/FeedScreen.test.tsx`의 "댓글 작성 직후 서버가 준 작성자 프로필 사진을 보여준다"

## 확인된 영향

- 영향 도메인: 피드·미디어의 댓글 작성
- 영향 계약: `contracts/API.md` `API-COMMENTS-002`의 `201` 응답 필드에 `author`를 추가한다. Method, Path, 요청 형식, 오류 코드는 변경하지 않는다. `API-COMMENTS-001`과 `contracts/DATA_MODEL.md`는 변경하지 않는다.
- 영향 화면: 게시글 상세 `D-3`의 댓글 목록. 작성 직후 아바타가 즉시 실제 사진으로 표시된다.
- 검증 범위: 백엔드 `CommentApiTest`에서 생성 응답의 `author.memberId`·`displayName`·서명된 `profileImageUrl`을 확인했고, 프론트는 생성 응답 파싱과 화면 반영을 각각 테스트로 고정했다. 화면 테스트는 수정 전 코드에서 실패하는 것을 확인했다.

## 확인이 필요한 질문

- 생성 응답에 `updatedAt`도 함께 맞출지. 목록과 수정 응답에는 있으나 생성 응답에는 없다. 이번 범위에서는 손대지 않았고, 앱은 `createdAt`을 그대로 쓰고 있다.
- 같은 이유로 게시글 생성(`API-POSTS-004`) 응답에도 `author`가 필요한지. 게시글 작성 후 화면 흐름이 댓글과 다르므로 이번 조사 범위에 넣지 않았다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
