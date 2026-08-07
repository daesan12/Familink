# 주간 효자 랭킹 지표를 적립 날짜 수에서 주간 게시글 건수로 변경

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-07
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/domains/CARNATIONS_AND_RANKING.md`, `docs/specs/contracts/API.md` `API-CARNATION-001`
- 관련 작업: S15P11B104-346

## 기존 내용

- `docs/specs/domains/CARNATIONS_AND_RANKING.md`의 "AI 작업 컨텍스트" 핵심 규칙은 "보호자가 현재
  그룹에 게시글을 한 건 이상 작성한 KST 날짜마다 카네이션을 하나만 적립한다. 주간 경계는
  월요일이며 공동 1위를 허용하고, 지난주 1위에게 왕관을 표시한다"이다. 랭킹 점수와 적립
  단위가 하나의 규칙으로 묶여 있다.
- 같은 문서 "확정된 동작" 2번은 "같은 보호자 구성원이 같은 그룹에서 하루에 여러 게시글을
  작성해도 KST 날짜당 카네이션은 하나만 적립한다"로, **하루에 몇 건을 쓰든 점수는 1**임을
  규정한다.
- 같은 문서 "확정된 동작" 3번은 "게시글이 삭제되어도 이미 적립된 카네이션 기록은 보존한다"로,
  점수가 게시글 존재 여부와 분리되어 있음을 규정한다.
- 같은 문서 "확정된 동작" 5·6번은 주 시작을 월요일로, 공동 1위 허용과 지난주 1위 왕관을
  규정한다. 이번 제안은 이 두 항을 바꾸지 않는다.
- `docs/specs/contracts/API.md`의 `API-CARNATION-001` 성공 응답은
  `rankings[{memberId,displayName,carnationCount,previousWeekWinner}]`이다. 수치 필드는
  `carnationCount` 하나뿐이며 게시글 수 필드는 계약에 없다.
- 현재 구현도 위 규정과 일치한다.
  - `backend/.../carnation/service/CarnationService.java`의 `earnForPost`가 글 작성 시
    `LocalDate.now(Asia/Seoul)`로 `carnations` 1행을 적립한다.
  - `backend/.../carnation/repository/CarnationRepository.java`의 `insertIfAbsent`가
    `on conflict (group_member_id, earned_date) do nothing`으로 하루 1행을 강제하고,
    `V1__create_schema.sql`의 `uq_carnations_member_date UNIQUE (group_member_id, earned_date)`가
    이를 DB에서 보장한다.
  - 랭킹 집계 `countByMember`는 `posts`를 전혀 읽지 않고 `carnations` 행 수만 센다. 따라서
    한 사람의 주간 점수 상한은 7이다.
- 랭킹 화면(`frontend/src/features/group-info/components/WeeklyRankingModal.tsx`)에는 순위·아바타·
  이름·왕관만 표시되고 수치가 렌더링되지 않는다. `carnationCount`는 정렬에만 쓰인다.

## 제안 내용

`docs/specs/domains/CARNATIONS_AND_RANKING.md`에 다음을 반영한다. 항 번호는 반영 시점에 결정한다.

1. 주간 효자 랭킹의 점수는 **해당 주(KST 월요일~일요일)에 작성되어 조회 시점에 남아 있는
   게시글 건수**로 한다. 같은 날 여러 건을 작성하면 그만큼 점수가 올라가며 주간 상한은 없다.
2. 카네이션 적립과 잔디 조회는 지금과 같이 **KST 날짜 단위를 유지한다.** 카네이션 달력
   (`API-CARNATION-002`)과 마이페이지 월간 도장은 "그날 활동했는지"를 계속 보여 준다. 이로써
   랭킹의 기준과 잔디의 기준이 서로 다른 지표가 된다는 점을 스펙에 명시한다.
3. 기존 "확정된 동작" 2번의 "하루에 여러 게시글을 작성해도 카네이션은 하나"는 **적립·잔디에만
   적용되고 랭킹 점수에는 적용되지 않는다**는 점을 구분해 기술한다.
4. 기존 "확정된 동작" 3번의 "게시글이 삭제되어도 적립 기록은 보존한다"도 **적립·잔디에만
   적용된다.** 랭킹 점수는 남아 있는 게시글만 세므로, 게시글을 삭제하면 그 주 점수가 줄고
   이미 지난 주차의 순위와 왕관도 사후에 바뀔 수 있다. 이 변동을 허용한다.
5. 랭킹 대상은 기존과 같이 보호자(`GroupRole.GUARDIAN`)로 제한한다. 피보호자의 게시글은 랭킹에
   반영하지 않는다.
6. 주 경계(KST 월요일 시작·7일), `startDate`/`endDate` 검증과 `400 INVALID_REQUEST`, 공동 순위
   허용, 지난주 1위 왕관은 그대로 유지한다. 지난주 1위 판정도 게시글 건수 기준으로 계산한다.
7. 랭킹 화면은 각 행에 그 주의 게시글 건수를 함께 표시한다. 현재는 수치가 표시되지 않아
   순위 근거를 확인할 수 없다.

`docs/specs/contracts/API.md`의 `API-CARNATION-001` 성공 응답을 다음으로 바꾼다.

```text
rankings[{rank,memberId,displayName,postCount,previousWeekWinner}]
```

- `carnationCount`를 `postCount`로 바꾼다. 값의 의미가 "적립된 카네이션 개수"에서 "주간 게시글
  건수"로 바뀌므로 이름을 함께 맞춘다. 카네이션은 여전히 하루 1개이므로 이름을 유지하면
  같은 이름이 두 의미로 쓰여 오해를 만든다.
- `postCount`에는 주당 7 상한이 없다.

인수 조건을 다음으로 추가한다. 번호는 반영 시점에 결정한다.

- Given: 한 보호자가 같은 KST 날짜에 게시글을 2건 작성했다.
- When: 그 주의 주간 랭킹을 조회한다.
- Then: 해당 보호자의 `postCount`가 2이고, 같은 날짜의 카네이션 잔디는 1개로 유지된다.

### 함께 정정할 기존 계약 결함 2건

이번 변경과 원인은 다르지만 `API-CARNATION-001` 같은 줄을 수정하므로 함께 반영한다.

- 실제 응답 DTO(`GrassRankingResponse`)에 있는 `rank` 필드가 계약에서 누락되어 있다.
  `backend/src/test/java/com/ssafy/s15p11b104/domain/carnation/CarnationApiTest.java`가 이미
  `rank`를 검증하고 있으므로 문서 쪽이 뒤처진 것이다.
- `displayName`이 조회자 기준 별칭(`MemberAlias`) 우선이고 없을 때 실명으로 대체된다는 규칙이
  계약에 없다. `CarnationService.getGrass`가 `memberAliasRepository`로 조회자별 별칭을 적용한다.

## 변경 근거

- 사용자 요구다. QA 과정에서 "게시글을 올린 일자 수"가 아니라 "그 주에 올린 게시글 수"로
  순위를 매기기를 원한다는 요구가 확인되었다. QA 원문:
  `https://app.notion.com/p/3b4e66fae19280799abde96be842e207`
- 현재 지표는 참여량을 구분하지 못한다. 주 3일 동안 12건을 올린 사람과 주 3일 동안 3건을
  올린 사람의 점수가 똑같이 3이다. "효자 랭킹"이 전달하려는 참여 정도와 어긋난다.
- `posts` 직접 집계를 택한 근거는 마이그레이션이 필요 없고 과거 데이터가 바로 정확해지기
  때문이다.
  - `posts`에 `group_id`, `author_member_id`, `created_at TIMESTAMPTZ`가 모두 NOT NULL로 있고
    `idx_posts_group_created_at (group_id, created_at DESC)`가 그룹+기간 조회를 커버한다.
    `PostRepository.findArchivePage`가 이미 같은 `createdAt >= :startAt and < :endAt` 패턴을 쓴다.
  - 대안으로 검토한 "`carnations`에 `post_count` 컬럼 추가"는 Flyway 마이그레이션이 필요한 데다,
    기존 행은 하루 1행이라 과거 건수를 복원할 수 없어 소급 정확도가 오히려 낮다. 어느 방식을
    골라도 과거 값의 근거는 `posts`에 남은 글이 전부다.
- 삭제로 인한 과거 순위 변동을 감수하는 근거는 소프트 삭제 도입이 이번 범위보다 크기 때문이다.
  `backend/.../feed/service/PostService.java`의 삭제는 `postRepository.delete(post)` 하드 삭제이고
  `docs/specs/contracts/DATA_MODEL.md`의 `posts`에 `deleted_at`이 없다. 같은 문서는 "게시글을
  하드 삭제하면 미디어·댓글·반응·분석도 함께 정리한다"고 규정한다. 소프트 삭제 전환은 이
  연쇄 삭제 규칙 전체를 다시 정해야 하므로 별도 결정 대상이다.
- 7번(화면 수치 표시)의 근거는 검증 가능성이다. 지금은 순위만 보여 사용자가 "왜 내가 2등인지"
  확인할 수 없고, 지표를 바꿔도 바뀐 것을 화면에서 확인할 수 없다.
- `docs/spec-changes/pending/`에 카네이션·랭킹 지표를 다루는 기존 제안이 없다.

## 확인된 영향

- 영향 도메인: `CARNATIONS_AND_RANKING`. 랭킹 지표만 바뀌고 적립·잔디 규칙은 유지된다.
  `FEED` 도메인의 게시글 작성·삭제 동작은 바뀌지 않으나, 랭킹 점수가 게시글 생명주기에
  새로 의존하게 된다.
- 영향 계약: `API-CARNATION-001` 응답의 `carnationCount` → `postCount` 이름과 의미, 그리고 값의
  상한 제거. **응답 필드명이 바뀌므로 차단 변경이다.** `API-CARNATION-002`(카네이션 달력)와
  `DATA_MODEL.md`의 `carnations`·`posts` 스키마는 바뀌지 않는다. DB 마이그레이션이 없다.
- 영향 화면: IA `H-3p` 주간 효자 랭킹(`WeeklyRankingModal`). 각 행 오른쪽에 게시글 건수를
  추가한다. 마이페이지 순위 배지와 구성원 프로필 팝업은 순위만 쓰므로 표시가 바뀌지 않지만,
  응답 파서(`frontend/src/features/group-info/api/carnationApi.ts`)와 타입은 함께 바뀐다.
  잔디 달력과 마이페이지 월간 도장 화면은 바뀌지 않는다.
- 검증 범위: 백엔드 `./gradlew test --tests '*Carnation*'`와 `./gradlew build`. 특히 같은 날 2건
  → 2점, KST 주 경계(월요일 00:00 직전·직후와 일요일 23:59), 지난주 왕관의 게시글 수 기준 판정,
  피보호자 게시글 제외를 회귀 케이스로 고정한다. `posts.created_at`은 UTC `Instant`이고 주
  경계는 KST `LocalDate`라 변환 회귀 위험이 가장 크다. 프론트엔드는
  `npm test -- --runInBand`와 `tsc --noEmit`, 랭킹 행에 건수가 보이는지 검증하는 케이스를
  새로 추가한다.
- 커버리지 갱신 후보: `docs/specs/COVERAGE.md`의 카네이션·랭킹 행. 확인 필요.
- 관련 제안: `applied/CHG-20260731-unknown-carnation-ranking-period-contract.md`가 같은
  `API-CARNATION-001`의 **기간 query 계약**을 확정했다. 이번 제안은 그 기간 규칙을 그대로 두고
  **지표만** 바꾸므로 서로 충돌하지 않는다.

## 확인이 필요한 질문

- 랭킹과 잔디의 기준이 갈라지는 것을 사용자에게 어떻게 설명할지 확인 필요. 랭킹은 "12개",
  같은 주 잔디는 "3칸"으로 보이므로 두 숫자가 다른 이유를 화면에서 안내할지 결정이 필요하다.
  이번 티켓 범위에는 안내 문구를 넣지 않았다.
- 지난주 순위와 왕관이 게시글 삭제로 사후 변동되는 것을 허용할지 재확인 필요. 시연 중
  게시글을 지우면 이미 발표한 순위가 바뀔 수 있다. 허용하지 않기로 하면 소프트 삭제 또는
  주간 스냅샷이 필요하고, 이는 별도 티켓 규모다.
- 게시글 건수에 상한을 둘지 확인 필요. 상한이 없으면 한 사람이 짧은 글을 다수 올려 순위를
  독점할 수 있다. 현재는 상한을 두지 않는 것으로 제안했다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
