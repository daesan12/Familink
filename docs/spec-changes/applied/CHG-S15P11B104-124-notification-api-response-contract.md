# 알림 API 성공 문구와 actor 응답 구조 확정

- 상태: 승인·반영 완료
- 제안자: Codex
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md`
  (`API-NOTIFICATIONS-002~007`)
- 관련 작업: `S15P11B104-124`
- 관련 제안:
  [`CHG-S15P11B104-114-common-response-envelope.md`](../pending/CHG-S15P11B104-114-common-response-envelope.md),
  [`CHG-20260731-unknown-list-pagination-contract.md`](../applied/CHG-20260731-unknown-list-pagination-contract.md),
  [`CHG-20260730-rudgh8182-notifications-fk-delete-behavior.md`](../applied/CHG-20260730-rudgh8182-notifications-fk-delete-behavior.md)

## 기존 내용

`docs/specs/contracts/API.md`의 「공통 경계」는 본문이 있는 성공 응답을
`{success,message,data}`로 반환하고 `message`에 API별 확정 문구를 사용하도록
정한다. 그러나 확인된 성공 문구 목록에는 `API-NOTIFICATIONS-001`만 있고
`API-NOTIFICATIONS-002~007`의 문구는 없다.

기존
`docs/spec-changes/pending/CHG-S15P11B104-114-common-response-envelope.md`의
일부 승인 기록도 나머지 API의 성공 문구는 승인 범위에서 제외했다고
명시한다. 따라서 현재 공식 스펙만으로는 알림 API 6개의 `message` 값을
정할 수 없다.

`API-NOTIFICATIONS-003`의 성공 결과에는 다음과 같이 `actor`라는 필드명만
있다.

> `content[{id,type,title,body,groupId,actor,...}]`

`docs/specs/contracts/DATA_MODEL.md`에서 `notifications.actor_user_id`는
선택 FK이고 관련 대상 삭제 시 `ON DELETE SET NULL`이다. 회원 탈퇴는 사용자
행을 지우지 않지만 이름과 프로필 이미지 같은 개인정보를 NULL로 익명화한다.
그러나 API 계약에는 `actor`의 내부 필드와 nullable 규칙이 없다.

알림 목록의 `page`, `size`, `hasNext`, `createdAt DESC, id DESC` 정렬은
`CHG-20260731-unknown-list-pagination-contract.md`가 이미 승인·반영했으므로
이 제안에서 다시 결정하지 않는다.

## 제안 내용

### R1. `API-NOTIFICATIONS-002~007` 성공 문구

각 성공 응답은 공통 성공 봉투에 아래 문구를 정확히 사용한다.

| API ID | 성공 `message` |
|---|---|
| `API-NOTIFICATIONS-002` | `읽지 않은 알림 개수 조회 성공` |
| `API-NOTIFICATIONS-003` | `알림 목록 조회 성공` |
| `API-NOTIFICATIONS-004` | `알림 읽음 처리 성공` |
| `API-NOTIFICATIONS-005` | `전체 알림 읽음 처리 성공` |
| `API-NOTIFICATIONS-006` | `푸시 알림 설정 조회 성공` |
| `API-NOTIFICATIONS-007` | `푸시 알림 설정 저장 성공` |

`API-NOTIFICATIONS-008`은 `204 No Content`이므로 성공 봉투와 문구를
추가하지 않는다.

### R2. `API-NOTIFICATIONS-003.actor`

`actor`는 다음 객체 또는 `null`이다.

```text
actor: {
  userId: number,
  name: string | null,
  profileImageUrl: string | null
} | null
```

- `actor_user_id`가 없거나 관련 사용자 참조가 삭제됐다면 `actor=null`이다.
- actor가 있으면 `userId`는 필수다.
- 회원 탈퇴로 개인정보가 익명화될 수 있으므로 `name`과
  `profileImageUrl`은 nullable이다.
- `memberId`, `role`, `displayName`, `loginId`, 생년월일, 성별은 포함하지
  않는다.
- `actor`는 현재 조회 가능한 최소 사용자 메타데이터다. 과거 시점에
  수신자별 호칭을 적용한 알림 문구는 기존 계약대로 `title`과 `body`
  스냅샷을 사용한다.

검증 문장:

1. `API-NOTIFICATIONS-002~007`의 성공 응답이 R1의 문구와 공통 성공
   봉투를 정확히 사용한다.
2. 행위자가 있는 알림은 `actor={userId,name,profileImageUrl}`, 시스템
   알림이나 행위자 참조가 없는 알림은 `actor=null`을 반환한다.
3. 탈퇴한 행위자의 개인정보가 NULL이어도 알림 목록 직렬화가 실패하지
   않고 `name=null`, `profileImageUrl=null`을 반환한다.
4. 화면·레이아웃·화면용 파생 문자열은 추가하지 않는다.

## 변경 근거

- 공통 성공 봉투 구현은 모든 본문 성공 응답에 문자열 `message`를 요구한다.
  문구를 각 구현자가 추측하면 백엔드 테스트와 프런트엔드 계약이 달라질 수
  있다.
- `Notification` 엔티티는 actor로 `User`를 직접 참조한다. 최소 사용자
  식별·표시 정보만 반환하면 별도 그룹 멤버십·별칭 계약을 새로 만들지
  않는다.
- `name`과 `profileImageUrl`을 필수로 두면 회원 탈퇴 후 익명화된 사용자가
  actor인 과거 알림을 조회할 때 직렬화할 수 없다.
- 알림의 역사적 문구는 이미 `title`·`body` 스냅샷으로 보존되므로 actor
  객체까지 별도 스냅샷 데이터로 확장할 필요가 없다.

## 확인된 영향

- 영향 도메인: 앱 내부 알림 조회·읽음 처리·푸시 설정
- 영향 계약: `API-NOTIFICATIONS-002~007` 성공 `message`,
  `API-NOTIFICATIONS-003.actor`
- 영향 화면: 없음. 기존 화면 구현과 레이아웃은 작업 범위에서 제외
- 검증 범위: 6개 성공 문구, actor 존재·부재·탈퇴 사용자, 공통 성공 봉투,
  기존 페이지네이션·정렬 회귀

## 확인이 필요한 질문

1. R1의 성공 문구 6개를 공식 계약으로 승인할지.
2. R2의 최소 actor 객체와 nullable 규칙을 공식 계약으로 승인할지.

## 결정 및 반영

- 결정: 승인 (R1~R2 권장안 전체)
- 결정자: 사용자
- 결정일: 2026-07-31
- 반영 문서:
  - `docs/specs/contracts/API.md`
  - `docs/specs/COVERAGE.md`
- 반영 커밋:
