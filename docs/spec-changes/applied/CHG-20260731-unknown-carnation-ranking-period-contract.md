# 카네이션 주간 랭킹 기간 query 계약 구체화

- 상태: 승인·반영 완료
- 제안자:
- 작성일: 2026-07-31
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` `API-CARNATION-001`, `docs/specs/domains/CARNATIONS_AND_RANKING.md`
- 관련 작업: `S15P11B104-208`

## 기존 내용

`docs/specs/contracts/API.md`의 `API-CARNATION-001`은 `GET /groups/{groupId}/grass`의 요청을 `path groupId; 원본의 기간 query`로만 적고 있다. 로컬 계약만으로는 query 필드명, 필수 여부, 기본 기간, 날짜 포함 범위와 잘못된 범위의 처리 규칙을 알 수 없다.

`docs/specs/domains/CARNATIONS_AND_RANKING.md`는 주간 랭킹의 시작 요일을 월요일로 확정하고, 날짜 범위로 현재·과거 기록을 조회할 수 있다고 규정한다. 그러나 한 번의 랭킹 조회가 반드시 월요일부터 일요일까지 한 주여야 하는지, 임의 날짜 범위도 허용하는지는 명시하지 않는다.

현재 백엔드는 선택 query `startDate`, `endDate`를 사용한다. 둘 다 생략하면 KST 기준 현재 주의 월요일부터 일요일까지 조회하고, 값을 지정하면 월요일 시작·7일 범위만 허용한다. 한쪽만 전달하거나 그 외 범위를 전달하면 `400 INVALID_REQUEST`를 반환한다.

## 제안 내용

다음 두 방식 중 하나를 승인해 `API-CARNATION-001`과 도메인 스펙을 함께 구체화한다. 승인 전에는 현재 구현 동작을 공식 계약으로 간주하지 않는다.

### A. 주간 범위만 허용

- query 이름을 `startDate`, `endDate`로 명시하고 두 값 모두 ISO-8601 날짜로 정의한다.
- 둘 다 생략하면 KST 기준 현재 주의 월요일부터 일요일까지 집계한다.
- 값을 지정할 때는 둘을 함께 보내며, `startDate`가 월요일이고 `endDate = startDate + 6일`인 범위만 허용한다.
- 조건을 어기면 `400 INVALID_REQUEST`를 반환한다.
- 과거 기록은 조회하려는 주의 월요일과 일요일을 지정해 조회한다.

### B. 임의 날짜 범위를 허용

- query 이름과 날짜 형식은 A안과 같이 명시한다.
- `startDate <= endDate`인 임의 범위를 허용하도록 랭킹 집계 의미와 응답의 `weekStart`, `weekEnd` 필드명을 함께 재정의한다.
- 현재 백엔드의 7일 제한을 변경하고 허용 가능한 최대 기간을 별도로 결정한다.

## 변경 근거

- 외부의 “원본”을 보지 않으면 공개 API query를 구성할 수 없어 로컬 스펙만으로 구현할 수 있다는 저장소 원칙을 충족하지 못한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/carnation/controller/CarnationController.java`는 `startDate`, `endDate`를 선택 query로 받는다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/carnation/service/CarnationService.java`는 KST 현재 주 기본값과 월요일 시작·7일 범위를 적용한다.
- `docs/spec-changes/pending/`과 `docs/spec-changes/applied/`에는 `API-CARNATION-001`의 기간 query 규칙을 다루는 기존 제안이 없다.

## 확인된 영향

- 영향 도메인: 카네이션 잔디와 현재·과거 주간 랭킹 조회
- 영향 계약: `API-CARNATION-001` 요청 query, 기본 기간, 날짜 범위 검증과 `400 INVALID_REQUEST` 조건
- 영향 화면: 주간 랭킹의 기간 선택·표시 화면(구현 여부 확인 필요)
- 검증 범위: 계약 문서 링크 검사, query 생략·정상 주간·한쪽만 전달·비월요일 시작·7일 초과 범위 API 테스트, KST 주 경계 테스트

## 확인이 필요한 질문

- 랭킹 조회는 월요일부터 일요일까지 한 주만 허용할 것인가?
- “날짜 범위로 현재·과거 기록 조회”는 과거의 주간 단위 조회를 뜻하는가, 임의 기간 조회를 뜻하는가?
- query를 한쪽만 전달하면 `400 INVALID_REQUEST`로 확정할 것인가?
- 날짜 경계와 기본 주 계산의 기준 시간대를 KST로 계약에 명시할 것인가?

## 결정 및 반영

- 결정: A안 전체 승인. `startDate`, `endDate`를 모두 생략하면 KST 현재
  주의 월요일부터 일요일까지 조회한다. 지정할 때는 두 값을 함께 보내고
  월요일부터 6일 뒤 일요일까지의 범위만 허용하며, 위반 시
  `400 INVALID_REQUEST`를 반환한다. 과거 기록도 같은 주간 단위로 조회한다.
- 결정자: 사용자(반영 승인), Codex(세부 계약 판단)
- 결정일: 2026-07-31
- 승인 근거: 사용자가 현재 반영되지 않은 불일치를 기록하고 Codex가 세부
  반영 방식을 판단해 `develop`까지 반영하도록 요청했다.
- 반영 문서: `docs/specs/domains/CARNATIONS_AND_RANKING.md`,
  `docs/specs/contracts/API.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
