# 알림 목록 응답에 리포트 이동용 조회 키 3종 추가

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-08-05
- 차단 변경: 예
- 영향 스펙·계약: `docs/specs/contracts/API.md` > `API-NOTIFICATIONS-003`
- 관련 작업: `docs/spec-changes/pending/CHG-20260805-rudgh8182-notification-tap-deep-link.md`

## 기존 내용

- `docs/specs/contracts/API.md` > 알림·기기 토큰 > `API-NOTIFICATIONS-003`
  `GET /notifications` 성공 결과:
  `content[{id,type,title,body,groupId,actor,relatedJoinRequestId,relatedJoinRequestStatus,relatedPostId,relatedEventId,relatedCallReportId,relatedDailyReportId,readAt,createdAt}]`, `hasNext`
- 리포트 조회 계약: `API-REPORTS-002`는 `(groupId, memberId, reportDate)`,
  `API-REPORTS-003`은 `callSessionId`를 경로 파라미터로 요구한다.

## 제안 내용

`API-NOTIFICATIONS-003` 응답 `content[]`에 nullable 필드 3종을 추가한다.

| 필드 | 타입 | 채우는 경우 | 값 |
|---|---|---|---|
| `relatedCallSessionId` | number\|null | `CALL_REPORT` | 관련 통화 리포트의 `callSessionId` |
| `relatedCareReceiverMemberId` | number\|null | `CALL_REPORT`, `DAILY_REPORT` | 리포트 대상 피보호자의 `memberId` |
| `relatedReportDate` | `yyyy-MM-dd`\|null | `CALL_REPORT`, `DAILY_REPORT` | 리포트 날짜. `CALL_REPORT`는 통화 종료 시각을 일일 리포트 창 규칙(`DailyReportWindow`)으로 환산 |

- 그 외 타입에서는 3필드 모두 `null`이다. `CALL_REPORT`의 통화 종료 시각이
  비정상적으로 없으면 `relatedReportDate`만 `null`로 남긴다.
- 기존 필드는 변경하지 않는다. 추가 필드는 nullable이라 기존 클라이언트와
  하위 호환된다.
- 푸시 data payload는 기존 결정대로 `notificationId`·`type`만 유지한다
  (`CHG-S15P11B104-125`의 잠금화면 노출 최소화 결정과 충돌 없음).

## 변경 근거

- 알림 탭에서 리포트 상세로 이동하려면 리포트 조회 API의 경로 파라미터가
  필요한데, 기존 응답의 `relatedCallReportId`·`relatedDailyReportId`는 각각
  `call_reports.id`·`daily_reports.id`라 그대로는 조회할 수 없다.
  (`backend/.../notification/service/DomainNotificationRoutingService.java`가
  `report.getId()`를 저장하는 것을 확인. 프론트 조회는
  `GET /call-sessions/{callSessionId}/report`와
  `GET /groups/{groupId}/members/{memberId}/reports/daily/{reportDate}`.)
- `Notification` 엔티티가 `relatedCallReport`(→`CallSession`)·`relatedDailyReport`를
  이미 보유해 저장 스키마 변경 없이 응답 시 조인으로 채울 수 있다.
- 구현: `NotificationListResponse.java`, `NotificationService.java`,
  `NotificationRepository.java`(EntityGraph 확장),
  `NotificationApiTest.listExposesReportRoutingKeysOnlyForReportNotifications`
  통과. 프론트 파서는 필드 부재를 허용해 배포 순서와 무관하다.

## 확인된 영향

- 영향 도메인: NOTIFICATIONS(응답 DTO), REPORTS(읽기 전용 조인 참조).
- 영향 계약: `API-NOTIFICATIONS-003` 응답 필드 추가(하위 호환).
- 영향 화면: 알림 목록(탭 이동), 리포트 화면(딥링크 진입).
- 검증 범위: `NotificationApiTest`(백엔드),
  `notificationApi.test.ts`·`deepLink.test.ts`(프론트) 통과 확인.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
