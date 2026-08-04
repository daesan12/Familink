# 가입 요청 알림의 현재 처리 상태 응답 확정

- 상태: 승인·반영 완료
- 제안자: unknown
- 작성일: 2026-08-03
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` (`API-NOTIFICATIONS-003`)
- 관련 작업: `S15P11B104-260`

## 기존 내용

`API-NOTIFICATIONS-003`은 알림 목록 항목에 `type`, `title`, `body`, `groupId`,
`actor`, `relatedJoinRequestId` 등을 반환하지만, 관련 가입 요청의 현재
상태는 반환하지 않는다.

도메인 알림 계약은 가입 요청 생성과 승인·거절 결과를 모두
`GROUP_JOIN_REQUEST` 유형으로 저장한다. 따라서 현재 응답만으로는 관리자에게
온 `PENDING_ADMIN` 요청과 신청자에게 온 `APPROVED`·`REJECTED` 결과, 이미
처리된 요청의 과거 알림을 구분할 수 없다.

## 제안 내용

`API-NOTIFICATIONS-003`의 알림 항목에 다음 nullable 필드를 추가한다.

```text
relatedJoinRequestStatus: PENDING_ADMIN | APPROVED | REJECTED | null
```

- `relatedJoinRequestId`가 있는 `GROUP_JOIN_REQUEST` 알림은 현재 가입 요청의
  상태를 반환한다.
- 관련 가입 요청이 없거나 다른 알림 유형이면 `null`을 반환한다.
- 앱은 `PENDING_ADMIN`인 경우에만 승인·거부 동작을 노출한다.
- `APPROVED`·`REJECTED` 알림은 읽음 가능한 알림 기록으로 남기되 재처리
  버튼과 역할 선택을 제공하지 않는다.
- 이미 처리된 관리자 알림도 같은 현재 상태를 사용해 재진입 후 재처리할 수
  없게 한다.

## 변경 근거

- `frontend/src/features/notifications/api/notificationApi.ts`는 현재 모든
  `GROUP_JOIN_REQUEST`를 `requestKind: 'groupJoin'`으로 변환한다.
- `frontend/src/features/notifications/components/NotificationItem.tsx`는
  `requestKind`만 보고 V/X 버튼을 표시한다.
- `backend/src/main/java/com/ssafy/s15p11b104/domain/notification/service/DomainNotificationRoutingService.java`는
  생성·승인·거절 사건을 같은 `GROUP_JOIN_REQUEST` 유형으로 저장한다.
- 현재 알림 API에는 삭제나 가입 요청 상태 확인 필드가 없어, 화면에서 처리한
  알림을 다시 조회했을 때 재처리 가능 여부를 판정할 수 없다.

## 확인된 영향

- 영향 도메인: 그룹 가입 요청·앱 내부 알림
- 영향 계약: `API-NOTIFICATIONS-003` 성공 응답
- 영향 화면: 알림 항목의 승인·거부 버튼과 역할 선택 팝업
- 검증 범위: 생성·승인·거절 알림의 상태 직렬화, 처리 후 재조회, 기존
  알림 유형 회귀

## 결정 및 반영

- 결정: 승인 (제안 전체)
- 결정자: 사용자
- 결정일: 2026-08-03
- 반영 문서:
  - `docs/specs/contracts/API.md`
  - `docs/specs/COVERAGE.md`
- 반영 커밋:
