# 프로필 수정의 부분 수정 규칙과 사용자 API 성공 문구 확정

- 상태: 일부 승인
- 제안자: 이경호
- 작성일: 2026-07-29
- 차단 변경: 예
- 영향 스펙·계약: `contracts/API.md` `API-USERS-001`·`API-USERS-002` 및 「공통 경계」의 확인된 성공 문구, `domains/ACCOUNT_AND_PROFILE.md` 「확정된 동작」 7번
- 관련 작업: S15P11B104-116, `S15P11B104-210` F5
- 관련 제안: [`CHG-S15P11B104-114-common-response-envelope.md`](./CHG-S15P11B104-114-common-response-envelope.md), [`CHG-S15P11B104-114-login-id-character-rule.md`](../applied/CHG-S15P11B104-114-login-id-character-rule.md), [`CHG-S15P11B104-116-withdrawal-side-effects.md`](./CHG-S15P11B104-116-withdrawal-side-effects.md), [`CHG-S15P11B104-210-file-upload-contract.md`](../applied/CHG-S15P11B104-210-file-upload-contract.md)

## 기존 내용

`docs/specs/contracts/API.md` 44행의 `API-USERS-002`는 요청 필드 이름만 열거한다.

> | `API-USERS-002` | `PATCH /users/me` | Spring Boot · 본인 | `name`, `loginId`, `birthDate`, `gender`, `profileImageUrl` | `200`: `id`, `name`, `updatedAt` | `400 INVALID_REQUEST`; `401 UNAUTHORIZED`; `403 FORBIDDEN`; `409 LOGIN_ID_DUPLICATED` |

`docs/specs/domains/ACCOUNT_AND_PROFILE.md` 「확정된 동작」 7번도 "사용자는 자신의 프로필을 조회·수정할 수 있다"까지만 규정한다.

즉 다음이 정의되어 있지 않다.

- 열거된 5개 필드가 모두 필수인지, 일부만 보내도 되는지
- 전달되지 않은 필드를 어떻게 처리하는지
- 프로필 이미지를 삭제하는 방법
- 로그인 ID를 자기 자신의 현재 값으로 보냈을 때의 결과
- `API-USERS-001`·`API-USERS-002`의 성공 응답 `message` 문구

## 제안 내용

팀 Notion 「API 명세서 2차 수정본」의 `API-USERS-002`(내 프로필 수정) 「입력 제약」·「처리 규칙」과 `API-USERS-001`(내 프로필 조회) 응답 예시에 이미 확정되어 있는 다음 내용을 로컬 스펙에 반영한다. 결정 대상이 아니라 로컬 스펙 누락분이다.

- **부분 수정이다.** 변경하려는 필드만 전달할 수 있고, 요청에 포함되지 않은 필드는 기존 값을 유지한다.
- **`profileImageUrl`에 `null`을 전달하면 기존 프로필 이미지를 삭제한다.** 따라서 이 필드는 "전달하지 않음"과 "명시적 `null` 전달"을 구분해야 한다.
- `loginId`, `name`, `birthDate`, `gender`에는 `null`이나 빈 문자열을 허용하지 않는다.
- 값이 전달되면 회원가입과 같은 형식 조건을 적용한다. `loginId` 5~15자, `name` 2~10자, `birthDate`는 `YYYY-MM-DD`, `gender`는 `MALE` 또는 `FEMALE`, `profileImageUrl`은 최대 500자다.
- **기존 `loginId`와 같은 값을 보내면 변경 없이 성공한다.** 다른 사용자가 사용 중인 값이면 `409 LOGIN_ID_DUPLICATED`이며 오류 문구는 `이미 사용 중인 로그인 아이디`다. 로그인 ID 변경 시 현재 비밀번호를 다시 입력받지 않는다.
- 사용자 식별은 변경될 수 있는 `loginId`가 아니라 변경되지 않는 사용자 PK를 기준으로 한다.
- **확인된 성공 문구**는 `API-USERS-001`이 `내 프로필 조회 성공`, `API-USERS-002`가 `내 프로필 수정 성공`이다. `API-USERS-003`은 `204 No Content`이므로 본문과 문구가 없다.
- `API-USERS-001`의 성공 응답 `data`는 `loginId`, `name`, `birthDate`, `gender`, `profileImageUrl`이며 사용자 ID를 포함하지 않는다. 요청자는 Access Token으로 이미 식별되어 있다.
- `API-USERS-002`의 `updatedAt`은 다른 API와 같이 ISO-8601 UTC 절대 시각이다.

Notion에도 정의되지 않아 이번 구현에서 판단한 사항은 다음 하나다.

- **필드를 하나도 담지 않은 `{}` 요청은 아무것도 변경하지 않고 `200`을 반환한다.** 결과 상태가 요청 전과 같으므로 오류로 처리할 근거가 없다.

`S15P11B104-210` F5에서 다음 프로필 이미지 연결 규칙을 추가로 제안한다.

- 클라이언트는 `API-FILES-001`에 `purpose=profile-image`와 이미지 1개를
  보내 업로드 URL을 받고, 응답의 모든 `headers`를 그대로 사용해 PUT한 뒤
  반환된 `fileUrl`을 `API-USERS-002`의 `profileImageUrl`로 전달한다.
- `profileImageUrl`을 요청에서 생략하면 기존 이미지를 유지하고, 명시적으로
  `null`을 보내면 삭제하며, 문자열을 보내면 새 이미지로 교체한다.
- 새 문자열은 설정된 S3 또는 허용 CDN 호스트이며 object key가
  `profile-image/` 아래인 주소만 허용한다. 저장 전에 스토리지 메타데이터로
  이미지 MIME과 10 MiB 제한을 다시 검증한다.
- DB에는 만료되지 않는 안정적인 `fileUrl`을 저장한다.
  `API-USERS-001` 조회에서는 접근 가능한 CDN URL 또는 다운로드용 서명 URL을
  `profileImageUrl`로 반환한다.
- 교체·삭제된 과거 객체의 실제 삭제와 고아 객체 정리는 별도 수명주기
  작업으로 다루며 프로필 수정 요청의 성공을 막지 않는다.

검증 문장: `{"name": "김영하"}`만 보내면 이름만 바뀌고 `loginId`·`birthDate`·`gender`·`profileImageUrl`은 그대로 유지된다. `profileImageUrl`을 담지 않으면 기존 이미지가 유지되고, `{"profileImageUrl": null}`을 보내면 이미지가 삭제된다. 자기 자신의 현재 `loginId`를 보내면 `200`이고, 다른 사용자가 쓰는 값을 보내면 `409 LOGIN_ID_DUPLICATED`다.

## 변경 근거

- 로컬 계약이 요청 필드만 열거하고 있어, 그대로 읽으면 5개 필드를 모두 필수로 구현할 수도 있다. 그 경우 프로필 사진만 바꾸려는 화면에서도 클라이언트가 항상 전체 값을 다시 보내야 하고, 값을 하나라도 빠뜨리면 기존 정보가 지워진다. Notion 명세는 부분 수정을 명시하므로 로컬 계약만 보고 구현하면 계약 해석이 갈린다.
- "전달하지 않음"과 "명시적 `null`"을 구분하지 못하면 `profileImageUrl` 삭제 규칙을 만족할 수 없다. 이름만 수정하는 요청이 프로필 이미지를 함께 지우는 결과가 되기 때문이다. 이 때문에 `ProfileUpdateRequest`만 레코드가 아닌 일반 클래스로 두고 이 필드의 전달 여부를 `@JsonSetter`로 기록했다. 다른 DTO는 레코드를 유지한다.
- 2026-07-29 백엔드 담당자가 부분 수정 방식을 선택했고, 이후 Notion 확정 명세에서 같은 규칙이 확인되었다.
- 성공 문구는 `CHG-S15P11B104-114-common-response-envelope.md`가 확정한 공통 응답 봉투의 `message` 값이다. 해당 제안은 2026-07-29 일부 승인되었고 "나머지 API의 성공 `message` 목록은 미확정이므로 승인 범위에서 제외하고 보류"되었다. 이 제안이 그중 `API-USERS-001`·`API-USERS-002` 두 건을 채운다.
- 2026-07-31 사용자는 `S15P11B104-210` F5를 권장안대로 결정했다.
  이 근거는 위 프로필 이미지 연결 규칙에 한정하며, 이 제안의 다른 미결
  질문까지 승인한 것으로 확대하지 않는다.
- `CHG-S15P11B104-114-login-id-character-rule.md`는 2026-07-30에
  `API-USERS-002`를 포함해 5~15자의 `[A-Za-z0-9]`, 대소문자 구분,
  정규화 없음으로 승인·반영됐다. 프로필의 로그인 ID 변경도 같은 규칙을
  사용하며 이 제안에서 별도 문자 정책을 결정하지 않는다.
- 구현과 검증 위치: `backend/src/main/java/com/ssafy/s15p11b104/domain/account/dto/ProfileUpdateRequest.java`, `backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/UserService.java`, `backend/src/test/java/com/ssafy/s15p11b104/domain/account/UserApiTest.java`

## 확인된 영향

- 영향 도메인: 계정·프로필의 프로필 조회·수정
- 영향 계약: `contracts/API.md` `API-USERS-002`에 부분 수정 의미, 필드별 형식 조건, `profileImageUrl`의 `null` 처리와 로그인 ID 판정 규칙을 추가한다. `API-FILES-001`의 `profile-image` 업로드 결과와 허용 저장소 주소를 연결한다. 「공통 경계」의 확인된 성공 문구 목록에 `API-USERS-001`·`API-USERS-002`를 추가한다. Method, Path, 요청·응답 필드 구성은 변경하지 않는다.
- 영향 화면: 확인 필요. 프로필 수정 화면이 변경된 필드만 전송하도록 구현해야 하고, 프로필 이미지 삭제는 필드를 생략하는 것이 아니라 `null`을 명시해 전송해야 한다.
- 검증 범위: `UserApiTest`에서 단일 필드 수정, 전체 필드 수정, 이미지 유지·삭제, 빈 요청, 자기 자신의 로그인 ID, 타인의 로그인 ID `409`, 회원가입이 거부하는 값의 `400`과 `errors` 필드 목록을 검증했다.

## 확인이 필요한 질문

- `loginId`·`name`·`birthDate`·`gender`에 명시적 `null`을 전달한 요청을 `400 INVALID_REQUEST`로 거부할지. Notion은 "허용하지 않는다"고만 적고 응답을 정하지 않았다. 현재 구현은 필드 미전달과 같게 보아 "변경하지 않음"으로 처리하며, 결과 상태는 정상 요청과 같다. 엄격하게 `400`으로 거부해야 한다면 네 필드도 전달 여부를 따로 기록해야 한다.
- 로그인 ID 변경 후 이전 로그인 ID를 다른 사용자가 즉시 사용할 수 있는지. 현재는 UNIQUE 제약만 적용하므로 즉시 사용할 수 있다. 계정 도용을 우려한다면 유예 기간이 필요하다.

## 결정 및 반영

- 결정: 일부 승인. `S15P11B104-210` F5의 프로필 이미지 업로드·URL
  연결·생략/삭제/교체·허용 저장소 검증·안정 URL 저장·과거 객체 별도 정리
  범위만 승인해 반영한다. 이 제안의 다른 부분 수정·성공 문구·빈 요청·
  비이미지 필드 `null`·이전 로그인 ID 재사용 내용은 이번 승인 범위가
  아니므로 미결정으로 남긴다.
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서: `docs/specs/contracts/API.md`,
  `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
