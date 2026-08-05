# 알림 탭 딥링크 동작 정의

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-08-05
- 차단 변경: 아니오
- 영향 스펙·계약: `docs/specs/domains/NOTIFICATIONS.md`(화면 규칙), `docs/specs/UI_AND_NAVIGATION.md` 확인 필요
- 관련 작업: `docs/spec-changes/pending/CHG-S15P11B104-274-foreground-push-display.md`(딥링크를 별도 결정으로 보류), 관련 별도 Jira 티켓 확인 필요

## 기존 내용

- `docs/specs/domains/NOTIFICATIONS.md` > 확정된 동작 1~2: 확정된 화면 동작은
  "앱 내부 알림 목록과 읽지 않은 개수를 조회할 수 있다",
  "개별·전체 읽음 처리를 할 수 있다"뿐이며, **알림을 탭했을 때의 이동 동작은
  정의되어 있지 않다.**
- `docs/specs/domains/NOTIFICATIONS.md` > 구현 규칙 > 이벤트:
  "푸시 payload에는 화면 경로나 리포트 상세 같은 민감한 내용을 넣지 않는다."
  같은 문서 확정된 동작 24: "data payload는 `notificationId`·`type`만 포함한다."
- `CHG-S15P11B104-274`(pending): "알림을 탭했을 때의 이동 동작. …
  이 제안은 표시까지만 다루며 딥링크는 별도 결정과 티켓이 필요하다."

## 제안 내용

NOTIFICATIONS.md 화면 규칙에 다음 알림 탭 이동 동작을 추가한다.

1. 인앱 알림 목록에서 알림을 탭하면 읽음 처리 후 타입별 목적지로 이동한다.

   | 알림 타입 | 목적지 |
   |---|---|
   | `NEW_POST`, `POST_ACTIVITY` | 해당 게시글 상세(피드) |
   | `EVENT_CHANGED`, `EVENT_REMINDER` | 캘린더의 해당 일정 상세 모달. 상세를 닫으면 일정 날짜의 시트가 열린다 |
   | `CALL_REPORT` | 리포트 화면의 해당 날짜·피보호자 페이지로 이동 후 해당 통화 상세 모달 |
   | `DAILY_REPORT` | 리포트 화면의 해당 날짜·피보호자 페이지(그 자체가 일일 리포트) |
   | `GROUP_JOIN_REQUEST` | 그룹정보의 가입 승인 화면. 알림 행 내 인라인 승인·거부 버튼은 유지한다 |

2. 이동에 필요한 관련 참조(`relatedPostId`, `relatedEventId`, 리포트 조회 키)가
   응답에 없으면 탭은 읽음 처리만 하고 이동하지 않는다. 목적지 대상이
   삭제된 경우 각 화면의 기존 오류·재시도 표시를 그대로 사용한다.
3. 알림의 `groupId`가 현재 그룹과 다르고 사용자가 그 그룹에 소속돼 있으면
   그룹을 전환한 뒤 이동한다.
4. OS 푸시 알림 탭은 2단 해석으로 같은 목적지에 도달한다. 푸시 data
   payload는 기존 결정대로 `notificationId`·`type`만 유지하고, 앱은 탭 후
   알림 목록 첫 페이지에서 `notificationId`로 알림을 찾아 1의 규칙으로
   이동한다. 찾지 못하면 인앱 알림 목록 화면으로 폴백한다.
5. 푸시 탭으로 목적지를 해석한 알림은 읽음 처리한다(실패해도 이동은 유지).
6. 미인증·그룹 미로딩 상태(콜드 스타트)의 푸시 탭은 보관했다가 앱 셸 진입
   후 처리한다.

## 변경 근거

- 사용자 결정(2026-08-04 세션): 알림 탭 시 아무 화면 이동이 없는 문제를
  수정하되, 인앱 탭과 OS 푸시 탭 모두 상세까지 연결하기로 확정.
- 현행 코드: `frontend/src/features/notifications/screens/NotificationsScreen.tsx`의
  탭 핸들러가 `postId`만 처리해 7개 타입 중 게시글 계열 2개만 이동했다.
  `NotificationPresenter.kt`의 contentIntent에 extras가 없고 `MainActivity.kt`가
  intent를 읽지 않아 푸시 탭은 앱만 열렸다.
- 구현: 공용 해석기 `frontend/src/features/notifications/deepLink.ts`,
  AppShell 라우팅(`frontend/src/app-shell/AppShell.tsx`), 네이티브 탭 전달
  (`MainActivity.kt`, `NotificationTapStore.kt`, `FamilinkNotificationsModule.kt`,
  `notificationTapProvider.ts`)로 구현·테스트 완료.
- 푸시 payload 최소화(CHG-S15P11B104-125의 잠금화면 노출 최소화 결정)와
  충돌하지 않도록 payload는 `notificationId`·`type`을 유지하고 2단 해석을
  택했다.

## 확인된 영향

- 영향 도메인: NOTIFICATIONS(화면 규칙만). 알림 저장·발송 규칙은 무변경.
- 영향 계약: 리포트 딥링크는 `API-NOTIFICATIONS-003` 응답 보강이 전제 —
  별도 제안 `CHG-20260805-rudgh8182-notification-list-report-routing-fields.md`.
- 영향 화면: 알림 목록, 피드(게시글 상세), 캘린더, 리포트, 그룹정보(가입 승인).
- 검증 범위: frontend jest(딥링크 해석기·알림 화면·AppShell·목적지 3화면),
  Android 단위·계측 테스트(extras·requestCode·tap store), 수동 3상태
  (포그라운드/백그라운드/종료) 푸시 탭 확인 필요.

## 확인이 필요한 질문

- 이 딥링크 작업을 어느 Jira 티켓으로 관리할지(CHG-274의 미해결 질문과 동일).
- 푸시 탭 폴백(알림 목록 화면)이 제품 기대와 일치하는지.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
