# 앱 실행 중 푸시 수신 시 미읽음 배지·알림 목록 실시간 갱신

- 상태: 제안
- 제안자: rudgh8182
- 작성일: 2026-08-05
- 차단 변경: 아니오
- 영향 스펙·계약: [`COMMON`](../../specs/COMMON.md) 서비스와 데이터 소유권, [`NOTIFICATIONS`](../../specs/domains/NOTIFICATIONS.md) 확정된 동작·화면
- 관련 작업: [CHG-S15P11B104-274](CHG-S15P11B104-274-foreground-push-display.md)(선행 — 같은 `onMessageReceived` 경로를 전제), [CHG-S15P11B104-213](../applied/CHG-S15P11B104-213-notification-native-bridge-boundary.md)

## 기존 내용

[`COMMON.md`](../../specs/COMMON.md) `서비스와 데이터 소유권` L88-92:

> 푸시 등록 토큰 경계의 Kotlin 구성요소는 FCM 등록 토큰의 발급과 갱신 전달만 담당한다. `FirebaseMessagingService`는 `onNewToken`으로 받은 토큰을 React Native에 전달하는 역할로 한정하며 알림 표시를 담당하지 않는다.

[`NOTIFICATIONS.md`](../../specs/domains/NOTIFICATIONS.md):

- `화면`(L162-165)은 표시할 결과로 "읽지 않은 개수"를 규정하지만, 그 값을 언제 다시 조회해 갱신하는지는 정하지 않는다.
- `확정된 동작` 1번(L16)은 읽지 않은 개수의 조회 가능만 규정한다.

현재 구현: 앱 셸은 피드 진입·재탭 시에만 `API-NOTIFICATIONS`의 unread-count를 조회한다([`AppShell.tsx`](../../../frontend/src/app-shell/AppShell.tsx) 배지 조회 effect). 앱 실행 중 푸시가 도착해도 그 사실이 React Native에 전달되는 경로가 없어, 피드 화면을 계속 보고 있는 동안에는 종 모양 배지가 갱신되지 않는다.

## 제안 내용

1. 앱 실행 중 FCM 메시지를 수신하면 `FamilinkMessagingService`가 React Native에 푸시 수신 이벤트(`FamilinkNotifications:pushReceived`, payload 없음)를 전달한다. React 인스턴스가 없으면 전달하지 않는다(다음 피드 진입 조회로 수렴).
2. 앱 셸은 이 이벤트를 받으면 unread-count를 재조회해 피드 헤더의 미읽음 배지를 갱신한다. 알림 화면을 보는 동안에는 구독하지 않고 화면이 보고한 값을 유지한다(읽음 처리 커밋 전 값으로 되돌아가는 경쟁 방지 — 기존 배지 조회 규칙과 동일).
3. 알림 목록 화면을 보는 동안 같은 이벤트를 받으면 목록 첫 페이지를 다시 조회해 **화면에 없던 새 알림만 목록 맨 위에 끼워 넣는다**. 기존 항목의 읽음·가입 요청 결정 상태와 스크롤 위치는 덮어쓰지 않으며, 미읽음 수는 새로 끼워 넣은 미읽음 알림 개수만큼만 올린다(전체 재조회 시 낙관적 읽음 처리가 서버 커밋 전 값으로 되돌아가는 경쟁 방지).
4. 이벤트에는 알림 식별자·내용을 싣지 않는다. 푸시 payload 구성, API 계약, 데이터 계약은 변경하지 않는다.
5. `COMMON.md`의 푸시 등록 토큰 경계 문구에 `FirebaseMessagingService`의 역할로 "앱 실행 중 푸시 수신 사실의 React Native 전달"을 추가한다.

## 변경 근거

- 2026-08-05 사용자 결정: 사용자 A가 피드 화면을 보고 있는 동안 좋아요·댓글 푸시가 도착해도 종 모양 배지가 실시간으로 갱신되지 않는 문제를, 네이티브 푸시 수신 이벤트 → unread-count 재조회 방식(검토한 3안 중 1안)으로 해결하기로 결정했다. 주기 폴링은 실시간이 아니며 서버 호출이 늘고, SSE·WebSocket 상시 연결은 배지 갱신 목적에 과하다는 판단으로 배제했다.
- 현행 스펙만으로는 이 동작을 구현할 수 없다. `COMMON.md` L88-92가 `FirebaseMessagingService`의 React Native 전달 역할을 토큰 갱신으로 한정하고 있어 문구 조정이 필요하다.
- 구현 코드: [`FamilinkMessagingService.kt`](../../../frontend/android/app/src/main/java/com/s15p11b104app/notifications/FamilinkMessagingService.kt)(이벤트 발신), [`pushReceivedProvider.ts`](../../../frontend/src/features/notifications/pushReceivedProvider.ts)(구독 어댑터), [`AppShell.tsx`](../../../frontend/src/app-shell/AppShell.tsx)(배지 재조회), [`NotificationsScreen.tsx`](../../../frontend/src/features/notifications/screens/NotificationsScreen.tsx)(새 알림 삽입). 기존 알림 탭 이벤트(`FamilinkNotifications:notificationTap`)와 같은 `emitDeviceEvent` → `DeviceEventEmitter` 구조를 재사용한다.
- 알림 목록 실시간 반영도 2026-08-05 같은 사용자 결정이다. 전체 재조회가 아닌 새 알림 삽입을 택한 이유: 화면이 낙관적 읽음 처리(즉시 읽음 표시 후 서버 반영·실패 시 복원)와 페이지네이션 상태를 가지므로, 전체 재조회는 스크롤 초기화와 읽음 상태 역행을 일으킨다.
- 표시 판정과 무관하게 이벤트를 전달한다. 배지의 근거는 서버에 저장된 내부 알림이므로 표시 문구가 비어 OS 알림을 건너뛰는 메시지도 배지 갱신 대상이다.

## 확인된 영향

- 영향 도메인: NOTIFICATIONS. 알림 저장·조회·읽음 처리·푸시 발송 동작은 변경되지 않고, 클라이언트의 배지 갱신 트리거와 알림 목록 새 알림 삽입 동작만 추가된다.
- 영향 계약: 없음. 기존 unread-count API를 그대로 사용한다.
- 영향 화면: 피드 헤더의 미읽음 배지, 알림 목록 화면.
- 검증 범위: jest(`AppShell.test.tsx` 푸시 도착 갱신·코얼레싱·알림 화면 구독 해제, `NotificationsScreen.test.tsx` 새 알림 삽입·읽음 상태 보존, `pushReceivedProvider.test.ts`), `tsc --noEmit`, ESLint, `:app:compileDebugKotlin` 통과. 실기기에서 포그라운드 수신 시 배지·목록 갱신 확인은 `확인 필요`.
- 알려진 한계: 푸시 설정이 꺼져 있거나 활성 기기 토큰이 없으면 푸시 자체가 오지 않아 실시간 갱신도 일어나지 않는다(기존 푸시 발송 조건의 결과이며, 피드 재진입 시 조회로 수렴). 다른 구성원 게시글에 대한 활동처럼 본인이 수신자가 아닌 사건도 갱신 대상이 아니다.
- 선행 의존: 이 제안은 `onMessageReceived` 콜백 사용을 전제하므로 미승인 상태인 [CHG-S15P11B104-274](CHG-S15P11B104-274-foreground-push-display.md)와 함께 검토해야 한다.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
