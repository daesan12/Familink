# 포그라운드 푸시 알림 표시를 네이티브 경계에 추가

- 상태: 제안
- 제안자: 손수호
- 작성일: 2026-08-03
- 차단 변경: 아니오
- 영향 스펙·계약: [`COMMON`](../../specs/COMMON.md) 서비스와 데이터 소유권, [`NOTIFICATIONS`](../../specs/domains/NOTIFICATIONS.md) 확정된 동작·화면
- 관련 작업: S15P11B104-274, [CHG-S15P11B104-213](../applied/CHG-S15P11B104-213-notification-native-bridge-boundary.md)

## 기존 내용

[`COMMON.md`](../../specs/COMMON.md) `서비스와 데이터 소유권` L88-92:

> 푸시 등록 토큰 경계의 Kotlin 구성요소는 FCM 등록 토큰의 발급과 갱신 전달만 담당한다. `FirebaseMessagingService`는 `onNewToken`으로 받은 토큰을 React Native에 전달하는 역할로 한정하며 알림 표시를 담당하지 않는다. 알림 목록·읽음·설정 화면과 그 상태 관리는 React Native가 구현한다.

[CHG-S15P11B104-213](../applied/CHG-S15P11B104-213-notification-native-bridge-boundary.md) L125:

> 알림 채널 생성과 알림 표시 코드는 추가하지 않는다.

[`NOTIFICATIONS.md`](../../specs/domains/NOTIFICATIONS.md):

- `확정된 동작`(L14-30)에 앱이 실행 중일 때의 푸시 표시 동작이 없다. L16-17은 목록 조회와 읽음 처리만 규정한다.
- `화면`(L162-165)의 진입점은 알림 목록, 알림 설정, 기기 권한·토큰 등록 흐름뿐이다. 표시할 결과는 읽지 않은 개수, 알림 내용·읽음 상태, 설정 토글 세 가지다.
- L106-107은 표시 payload를 `title`·`body`, data payload를 `notificationId`·`type`으로 확정하지만, 그 payload를 클라이언트가 언제 어떻게 화면에 띄우는지는 정하지 않는다.
- 알림 채널이나 채널 중요도에 대한 규정이 없다.

## 제안 내용

1. 푸시 등록 토큰 경계의 Kotlin 구성요소는 FCM 등록 토큰의 발급·갱신 전달과 **앱 실행 중 수신한 푸시 메시지의 OS 알림 표시**를 담당한다. `FirebaseMessagingService`는 `onNewToken`으로 받은 토큰을 React Native에 전달하고, `onMessageReceived`로 받은 메시지를 Android 알림으로 표시한다. 알림 목록·읽음·설정 화면과 그 상태 관리는 계속 React Native가 구현한다.
2. 앱은 푸시 알림 표시용 알림 채널을 하나 생성하고 그 중요도를 헤드업 배너가 표시되는 등급으로 설정한다. 이 채널을 Firebase 기본 알림 채널로 선언해 앱 실행 중과 백그라운드·종료 상태의 알림이 같은 채널과 같은 중요도로 표시되게 한다.
3. 앱 실행 중 푸시가 도착하면 화면 상단에 알림이 표시되고, 표시된 알림은 OS 알림함에 남아 이후에도 확인할 수 있다. 표시 내용은 기존 표시 payload인 `title`·`body`만 사용한다.
4. 사용자가 시스템 설정에서 해당 채널의 중요도를 직접 낮춘 경우 헤드업 배너가 표시되지 않는 것은 정상 동작으로 본다.

data payload 구성, 푸시 발송 조건, 알림 저장·읽음 처리, API 계약은 변경하지 않는다.

## 변경 근거

- 사용자 QA에서 "앱을 켜 둔 상태로 알림이 오면 상단에 아무것도 뜨지 않는다"가 결함으로 보고되어 S15P11B104-274로 등록되었다.
- Firebase 공식 문서: 앱이 포그라운드일 때는 `notification`·`data` 어느 페이로드든 시스템 트레이에 표시되지 않고 앱의 `onMessageReceived`로 전달된다. 백그라운드에서만 시스템이 표시한다.
- [`FamilinkMessagingService.kt`](../../../frontend/android/app/src/main/java/com/s15p11b104app/notifications/FamilinkMessagingService.kt) L9-11은 위 스펙에 따라 `onMessageReceived`를 구현하지 않았고, 기본 구현은 아무 동작도 하지 않는다.
- React Native 쪽에 알림 배너 컴포넌트, 전역 표시 호스트, 표시 트리거가 존재하지 않는다. `NotificationGateway`(`frontend/src/features/notifications/types.ts` L81-92)에도 표시 계열 메서드가 없다. 네이티브에서 RN으로 올라오는 이벤트는 토큰 갱신 하나뿐이다.
- 따라서 앱 실행 중 도착한 푸시는 저장·조회는 되지만 화면에 표시되는 경로가 어디에도 없다. 현재 스펙을 그대로 유지하면 이 결함을 고칠 수 없어 `IMPLEMENTATION_GAP`이 아니다.
- [`AndroidManifest.xml`](../../../frontend/android/app/src/main/AndroidManifest.xml)에 `com.google.firebase.messaging.default_notification_channel_id`가 없어 FCM SDK가 폴백 채널 `fcm_fallback_notification_channel`을 중요도 `IMPORTANCE_DEFAULT`로 생성한다(`firebase-messaging-25.1.1.aar`의 `CommonNotificationBuilder` 바이트코드에서 `NotificationChannel` 생성 인자 `3` 확인). 이 등급은 소리만 발생하고 헤드업 배너로 표시되지 않아 백그라운드에서도 상단 표시가 없다.
- [`2026-08-02-release-code-qa.md`](../../qa/2026-08-02-release-code-qa.md) L760은 이 공백을 이미 "현재 코드 결함으로 세지 않고 staging E2E와 제품 결정 대상으로 보류"로 기록했다. 이 제안이 그 제품 결정에 해당한다.
- 표시 방식은 2026-08-03 사용자 결정으로 OS 알림 방식을 선택했다. 앱 자체 배너 UI는 신규 컴포넌트·전역 호스트·애니메이션·상태 관리가 필요해 티켓 규모를 넘고, OS 알림함에 남지 않아 놓친 알림을 다시 볼 수 없다는 점이 배제 근거다.

## 확인된 영향

- 영향 도메인: NOTIFICATIONS. 알림 저장·조회·설정 동작은 변경되지 않고 클라이언트 표시 동작만 추가된다.
- 영향 계약: 없음. API 계약, 데이터 계약, 푸시 payload 구성은 변경되지 않는다.
- 영향 화면: 앱 실행 중 모든 화면 위에 OS 알림이 표시된다. React Native 화면 코드는 변경되지 않는다.
- 영향 문서: `COMMON.md`는 팀 공용 아키텍처 규칙이므로 브리지 경계 문구 변경을 팀에 공유해야 한다. API·DB 계약이 아니어서 다른 작업자의 진행을 막지는 않는다.
- 검증 범위: Kotlin 단위 테스트(표시 대상 판정), `assembleDebug`, 에뮬레이터에서 포그라운드·백그라운드·종료 상태 각각의 표시 확인, 시스템 설정에서 채널이 하나로 보이고 중요도가 높음인지 확인.
- 확인 필요: 운영 서버에서 실제 푸시 발송이 성공하는지. 앱이 보는 `https://api.familink360.com`은 `PUSH_ENABLED` 기본값이 `true`이지만 Firebase 서비스 계정 자격 증명이 실제로 주입되어 있는지는 배포 환경에서 확인해야 한다. staging은 `PUSH_ENABLED: "false"`로 푸시가 발송되지 않는다.
- 확인 필요: 알림을 탭했을 때의 이동 동작. `MainActivity`가 intent extras의 `notificationId`·`type`을 읽지 않아 앱만 열린다. 이 제안은 표시까지만 다루며 딥링크는 별도 결정과 티켓이 필요하다.

## 확인이 필요한 질문

- 알림 채널을 하나로 둘지, 알림 설정 7개 항목별로 나눌지. 이 제안은 표시 경로 복구를 목표로 단일 채널을 제안한다. 항목별 채널은 사용자가 OS 설정에서 종류별로 끌 수 있게 하지만 서버가 채널 ID를 payload에 실어 보내야 하므로 계약 변경이 필요하다.
- 알림 탭 이동을 어느 티켓에서 다룰지.

## 결정 및 반영

- 결정:
- 결정자:
- 결정일:
- 반영 문서:
- 반영 커밋:
