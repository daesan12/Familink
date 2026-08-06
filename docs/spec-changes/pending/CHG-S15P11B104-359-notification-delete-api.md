# 알림 영구 삭제 API 및 사용자별 삭제 범위

- 상태: 제안
- 차단 변경: 예
- 관련 Jira: S15P11B104-359, S15P11B104-360
- 영향 스펙: `API-NOTIFICATIONS`, `NOTIFICATIONS`

## 기존 내용

공식 API 계약(`docs/specs/contracts/API.md`의 `API-NOTIFICATIONS-001~008`)에는
알림 목록 조회와 읽음 처리만 정의되어 있고, 내부 알림을 사용자가 삭제하는 API는
정의되어 있지 않다. 알림 도메인 계약(`docs/specs/domains/NOTIFICATIONS.md`)도
읽음 처리와 보관을 중심으로 설명한다.

## 제안 내용

- `DELETE /notifications/{notificationId}`는 인증된 수신자의 알림 한 건을 물리 삭제한다.
- `DELETE /notifications`는 인증된 현재 사용자의 알림만 모두 물리 삭제한다.
- 다른 수신자의 알림 또는 존재하지 않는 알림은 기존 권한 오류 규칙에 따라 `403 FORBIDDEN`으로 응답한다.
- 두 삭제 API는 본문 없이 `204 No Content`를 반환한다.
- 알림 화면 진입만으로 읽음 처리하지 않으며, 사용자가 알림을 누른 경우에만 해당 알림을 읽음 처리한다.

## 변경 근거

- `backend/src/main/java/com/ssafy/s15p11b104/domain/notification/controller/NotificationController.java`에 삭제 동작이 필요하다.
- `frontend/src/features/notifications/screens/NotificationsScreen.tsx`에서 단건 스와이프와 전체 삭제 UX를 제공한다.
- 사용자가 승인한 통합 구현 계획(S15P11B104-359, S15P11B104-360)에 따라 서버 영구 삭제가 필요하다.

## 확인된 영향

- 알림 Repository와 서비스에 현재 수신자 조건의 삭제 연산이 추가된다.
- 프론트 `NotificationGateway`에 단건·전체 삭제 계약이 추가된다.
- 기존 읽음 처리 API는 호환성을 위해 유지한다.
- 승인 전 공식 스펙 문서에는 반영하지 않는다.

## 결정

- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
## UI policy decision

- Entering the notification screen does not mark all notifications as read.
- The existing top-level `mark all read` UI is replaced by the `delete notifications` / `delete all` UX in this approved change.
- The existing `markAllRead` server contract remains for compatibility; removing the all-read UI from the official notification spec requires a separate approval.
