# S15P11B104 출시 전 통합 QA 리포트

- 점검 일시: 2026-08-02 (Asia/Seoul)
- 기준 브랜치: develop
- 기준 커밋: 87459f14b579a69086268e0701dd380ceba45203
- 외부 보고서 후속 검증 기준: origin/develop 756dc9595d91866e3f01dc788a36db6a06d24c2d
- 점검 방식: 현재 체크아웃 읽기 전용 분석, CodeGraph 호출 경로 확인, 공식 로컬 스펙 대조, Codex Security 표준 스캔, 정적·단위 테스트, Android CLI 에뮬레이터 확인
- 제품 코드 변경: 없음
- 문서 역할: 코드 QA 33건과 보안 QA 8건을 함께 관리하는 단일 정본

## 결론

현재 상태로는 출시 보류를 권고한다.

총 41건을 확인했다. 코드 QA는 P0 0건·P1 13건·P2 20건이고, 보안 QA는 High 1건·Medium 4건·Low 3건이다. 특히 인증 복원 실패 시 영구 백화면, 운영 AI 통화 생성의 전면 401, AI 통화 제어·종료·토큰 수명주기 결함, 가입 요청 승인 UI의 무동작, 다중 로그인 계정·토큰 불일치, 프로필 fixture 덮어쓰기, 탈퇴 계정 부활·고아 그룹 생성, 확정 기능인 일정 Tool Calling 누락, 재시작 후 활성 통화 고착, Gemini 무제한 대기와 릴리스 debug 서명키 사용은 출시 전에 수정해야 한다.

모든 발견 사항과 출시 종료 조건은 이 문서에서 통합 관리한다. 보안 스캔 전체 문맥은 [한글 보안 QA 보고서](./2026-08-02-security-scan-ko.md)에서 확인한다. [봉인된 영문 원본](./2026-08-02-security-scan.md)은 스캔 메타데이터·등급·영향 위치의 원본 보존용이다. 원본이 참조하는 scan-local write-up·PoC는 프로젝트 복사본에 포함하지 않았으며, 출시 판단에 필요한 결과와 수정안은 아래 SEC-001~008에 통합했다.

| 구분 | 건수 | 출시 판단 |
| --- | ---: | --- |
| P0 | 0 | 즉시 중단 수준은 확인되지 않음 |
| P1 | 13 | 출시 전 수정·회귀 테스트 필요 |
| P2 | 20 | 출시 전 수정 권고, 최소한 재현 테스트와 운영 방어 필요 |
| 보안 | High 1 / Medium 4 / Low 3 | High는 출시 차단, Medium·Low는 노출 조건에 맞춰 출시 전 완화 필요 |
| 합계 | 코드 33 + 보안 8 | 총 41건 |

## 외부 보고서 교차검증 결과

| 제보 항목 | 판정 | 보고서 반영 |
| --- | --- | --- |
| 운영 `UnavailableCallActorResolver`가 항상 401 반환 | 확인 | 신규 QA-032, 기존 Jira `S15P11B104-214`와 수정 브랜치 확인 |
| release APK가 추적된 debug 키로 서명 | 확인 | 기존 SEC-001의 실제 APK 인증서 근거 보강 |
| `MediaUploadPolicy`가 profile·임의 purpose 검증 우회 | 확인 | 기존 SEC-003과 중복, 테스트 근거 보강 |
| `UserService`가 외부 프로필 이미지 URL 저장 | 확인 | 신규 QA-033 |

QA-032는 `origin/develop`에서 아직 재현되지만 `origin/feature/S15P11B104-214-jwt-call-actor-resolver`의 `988fc25` 커밋에서 수정 중이다. 이 브랜치는 후속 검증 시점에 `develop`보다 1커밋 앞서 있었으며 아직 병합 증거는 없다.

2026-08-02 후속 확인: `988fc25`는 병합 커밋 `8ba72e4`로 `develop`(local·origin 동일)에 병합되었다. 병합 후 검증 결과는 QA-032 항목의 후속 검증 기록을 따른다.

## 사용자 특수 케이스 추가 점검 범위

- 느린 응답 중 중복 탭·뒤로 가기·modal 닫기·다른 계정 재시도
- 프로필 조회 실패·지연과 저장·탈퇴의 동시 실행
- 알림 목록과 배지 일부 API만 실패하는 경우
- 데이터가 같은 시각에 몰리거나 페이지 요청이 극단적으로 큰 경우
- 22시 스케줄 순간 서버 중단·재시작
- Android 시스템 Back, 화면 회전, 200% 글꼴, 영구 권한 거부

추가 동적 점검에서는 화면 회전과 200% 글꼴에서 welcome·로그인 UI가 잘리지 않았고 crash buffer도 비어 있었다. 반면 회원가입 1/5에서 시스템 Back을 누르면 앱 내부 이전 화면이 아니라 Launcher로 종료되는 동작을 `emulator-5554`에서 재현했다.

## P1 발견 사항

### QA-001. 일시적인 인증 복원 오류가 영구 백화면을 만든다

- 중요도: 심각 (P1)
- 위치: [authSessionManager.ts](../../frontend/src/features/auth/session/authSessionManager.ts#L96) restore(), [App.tsx](../../frontend/App.tsx#L788) 인증 복원 effect, [App.tsx](../../frontend/App.tsx#L1391) 초기 render
- 문제 내용: 저장소 읽기 실패, 네트워크 오류, 인증 서버 5xx는 retryableError로 반환된다. App은 authenticated와 signedOut만 처리하고 retryableError와 Promise reject에서는 authenticationResolved를 true로 바꾸지 않는다. 이후 render가 계속 null을 반환하므로 사용자는 앱을 강제 종료하기 전까지 아무 화면도 볼 수 없다.
- 근거: [App.test.tsx](../../frontend/__tests__/App.test.tsx#L2248)는 현재 백화 동작을 정상 기대값으로 고정한다. 공식 UI 스펙은 일시 오류에서 세션을 유지하고 재시도 가능한 상태를 요구한다.
- 수정 가이드: 로딩, 복원 실패, 인증 완료 상태를 분리하고 세션을 삭제하지 않은 채 오류 화면과 재시도를 제공한다.

        if (result.status === "retryableError") {
          setAuthRestoreError(result.error);
          setAuthenticationResolved(true);
          return;
        }

        if (authRestoreError !== null) {
          return <AuthRestoreErrorScreen onRetry={restoreSession} />;
        }

### QA-002. WebRTC 연결 성공 직후 세션 참조가 제거된다

- 중요도: 심각 (P1)
- 위치: [AiCallRuntime.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallRuntime.kt#L159) start() finally, 같은 파일 setMicrophoneEnabled(), setSpeakerEnabled(), close()
- 문제 내용: start()가 성공해도 finally에서 webRtcSession을 null로 만든다. 연결된 native 세션 자체는 살아 있지만 이후 마이크·스피커 제어와 종료가 모두 null-safe no-op이 된다.
- 영향: 모든 정상 통화에서 음소거·스피커 버튼이 실제 미디어에 반영되지 않고, 종료 시 PeerConnection·오디오 장치·라우팅을 명시적으로 해제하지 못한다.
- 수정 가이드: 성공한 세션 참조는 유지하고 시작 실패 또는 close()에서만 동일 인스턴스를 원자적으로 제거·해제한다.

        try {
          // offer, server session, remote answer, connected
          webRtcSession = session
        } catch (error: Throwable) {
          synchronized(stateLock) {
            if (webRtcSession === session) webRtcSession = null
          }
          session.close()
          throw error
        } finally {
          synchronized(stateLock) { startJob = null }
        }

### QA-003. 통화 종료 요청은 한 번 실패하면 재전송할 수 없다

- 중요도: 심각 (P1)
- 위치: [AiCallRuntime.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallRuntime.kt#L243) dispatchPendingEndIfRequested(), [AiCallContent.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt#L237) finishCall()
- 문제 내용: HTTP 종료 요청 전에 endRequestSent를 true로 설정하고, 요청 실패 시 플래그와 실패한 CompletableDeferred를 복구하지 않는다. UI도 서버 응답 전에 Completed 또는 Cancelled로 전환한다.
- 영향: 일시적인 네트워크 실패 후 서버의 통화는 활성 상태로 남는다. 같은 Runtime에서 재시도하면 HTTP 요청 없이 이전 실패만 재사용되며, 다음 통화 생성은 ACTIVE_CALL_EXISTS 409로 차단될 수 있다.
- 수정 가이드: Ending 상태를 별도로 두고 성공 응답 뒤에만 완료 화면을 확정한다. 실패 시 기존 대기자에게 실패를 전달한 뒤 새로운 종료 attempt를 만들 수 있게 상태를 초기화한다. 서버 종료 API는 같은 종료 요청을 멱등하게 처리해야 한다.

        try {
          sessionClient.endCallSession(token, sessionId, terminationType)
          synchronized(stateLock) { endCompletion?.complete(Unit) }
        } catch (error: Throwable) {
          synchronized(stateLock) {
            endCompletion?.completeExceptionally(error)
            endCompletion = null
            endRequestSent = false
          }
          throw error
        }

### QA-004. 30분 Access Token 만료를 AI 통화 native 경로가 복구하지 못한다

- 중요도: 심각 (P1)
- 위치: [AiCallScreen.tsx](../../frontend/src/features/ai-call/screens/AiCallScreen.tsx#L20), [AiCallApi.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallApi.kt#L138), [application.yml](../../backend/src/main/resources/application.yml#L47)
- 문제 내용: 화면 진입 시 Access Token 재발급을 한 번 요청하지만 시작 버튼을 그 완료까지 막지 않는다. 이후 1초 타이머는 저장된 문자열만 읽고 만료 시점에 재발급하지 않는다. native OkHttp 호출에는 공통 Axios 401 재발급·1회 재시도가 적용되지 않는다.
- 영향: 만료 토큰으로 빠르게 통화를 시작하거나 30분을 넘긴 통화를 종료하면 401이 발생한다. QA-003과 결합하면 서버 활성 세션이 남아 다음 통화까지 막힌다.
- 수정 가이드: 통화 시작과 종료 직전에 공통 AuthSession의 single-flight 재발급을 거치고, native 보호 API도 401에서 정확히 한 번만 새 토큰으로 재시도한다.

        suspend fun <T> withFreshAccessToken(block: suspend (String) -> T): T {
          val token = tokenProvider.refreshAccessToken()
          return try {
            block(token)
          } catch (error: AiCallApiException) {
            if (error.statusCode != 401) throw error
            block(tokenProvider.refreshAccessToken())
          }
        }

### QA-005. 확정 기능인 날짜별 일정 Tool Calling이 구현되어 있지 않다

- 중요도: 심각 (P1)
- 위치: [OpenAiRealtimeGateway.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/OpenAiRealtimeGateway.java#L119) createSessionJson(), [SidebandToolHandler.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/SidebandToolHandler.java#L133) executeTool()
- 문제 내용: 세션 tools에는 최근 게시글 조회만 등록되고 get_calendar_events_by_date가 없다. 모델이 해당 이름을 직접 호출해도 handler가 UNKNOWN_TOOL을 반환한다.
- 영향: 사용자가 통화 중 오늘·내일·특정 날짜 일정을 물으면 확정된 서비스 기능이 동작하지 않거나 모델이 근거 없이 답할 수 있다.
- 스펙 근거: [AI_CALL.md](../specs/domains/AI_CALL.md#L44), [CALENDAR.md](../specs/domains/CALENDAR.md#L22)
- 수정 가이드: date_expression 하나만 받는 도구를 세션에 등록하고, 서버가 KST 기준 날짜 해석·현재 그룹·통화 소유권을 강제해 조회한다.

        Map<String, Object> calendarTool = Map.of(
          "type", "function",
          "name", "get_calendar_events_by_date",
          "parameters", Map.of(
            "type", "object",
            "properties", Map.of("date_expression", Map.of("type", "string")),
            "required", List.of("date_expression"),
            "additionalProperties", false
          )
        );
        session.put("tools", List.of(recentPostTool, calendarTool));

### QA-006. 프로세스 종료 후 활성 통화가 영구 고착된다

- 중요도: 심각 (P1)
- 위치: [CallSessionService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/CallSessionService.java#L70) create(), 같은 파일 prepareCall(), [CallSessionRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/repository/CallSessionRepository.java#L21)
- 문제 내용: CONNECTING 행은 외부 OpenAI 호출 전에 별도 트랜잭션으로 커밋된다. JVM이 응답 전 또는 IN_PROGRESS 중 종료되면 일반 예외 처리와 Sideband disconnect callback이 실행되지 않는다. 시작·주기 복구, lease, TTL도 없다.
- 영향: 해당 피보호자의 이후 통화 생성은 활성 상태 존재 검사에서 계속 409가 되어 운영자가 DB를 수정하기 전까지 복구되지 않는다.
- 수정 가이드: DB에 heartbeat 또는 expires_at을 두고 애플리케이션 시작과 주기 작업에서 stale CONNECTING을 FAILED, stale IN_PROGRESS를 INCOMPLETE로 원자 전환한다.

        @Transactional
        @Scheduled(fixedDelayString = "${ai-call.reconcile-delay:30s}")
        public void reconcileStaleCalls() {
          repository.findStaleForUpdate(clock.instant().minus(staleAfter))
            .forEach(session -> session.markUnexpectedDisconnect(clock.instant()));
        }

### QA-007. Gemini 호출에 총 제한시간이 없어 worker와 DB 트랜잭션이 무기한 고착될 수 있다

- 중요도: 심각 (P1)
- 위치: [GoogleGeminiClient.java](../../backend/src/main/java/com/ssafy/s15p11b104/global/ai/gemini/GoogleGeminiClient.java#L22), [PostAnalysisService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java#L47), [build.gradle](../../backend/build.gradle#L29)
- 문제 내용: google-genai 1.61.0의 HttpOptions에 timeout을 설정하지 않았다. 현재 SDK 기본 HTTP client는 총 call timeout을 두지 않는다. 게시글 분석은 @Transactional과 프로세스 ReentrantLock을 잡은 상태에서 외부 AI 호출을 수행한다.
- 영향: half-open 연결 한 건이 비동기 worker, DB connection·transaction, 게시글 분석 전역 lock을 무기한 점유해 후속 분석을 전부 막을 수 있다.
- 수정 가이드: 설정 기반 유한 timeout을 적용하고, 외부 AI 호출을 DB 트랜잭션 밖으로 분리한다. AI executor에도 queue·동시성 상한을 둔다.

        HttpOptions.builder()
          .baseUrl(baseUrl)
          .apiVersion("v1beta")
          .timeout(Math.toIntExact(requestTimeout.toMillis()))
          .headers(Map.of("x-goog-api-key", apiKey))
          .build()

### QA-020. 가입 요청 알림의 승인·거절 버튼이 실제 가입 요청을 처리하지 않는다

- 중요도: 심각 (P1)
- 위치: [NotificationItem.tsx](../../frontend/src/features/notifications/components/NotificationItem.tsx#L46), [NotificationsScreen.tsx](../../frontend/src/features/notifications/screens/NotificationsScreen.tsx#L190), [notificationApi.ts](../../frontend/src/features/notifications/api/notificationApi.ts#L164), 실제 처리 API [groupMembershipApi.ts](../../frontend/src/features/group-info/api/groupMembershipApi.ts#L56)
- 문제 내용: 알림 응답에서 `groupId`와 `relatedJoinRequestId`를 파싱하지만 승인·거절 버튼은 `notification.id`만 넘긴다. `handleDecision`과 역할 선택 완료 처리는 알림을 읽음·목록 제거할 뿐 `processJoinRequest`를 한 번도 호출하지 않는다.
- 사용자 재현: 관리자가 가입 요청 알림에서 거절하거나 승인 후 역할을 선택하면 알림은 사라지지만 서버 요청은 `PENDING_ADMIN`으로 남고 신청자는 가입·거절되지 않는다.
- 수정 가이드: 선택한 알림의 그룹·가입 요청 ID로 API 처리에 성공한 뒤에만 읽음·목록 제거를 수행하고, 실패하면 알림과 선택값을 유지해 재시도하게 한다.

        const target = notifications.find(item => item.id === notificationId);
        await processJoinRequest(target.groupId, {
          joinRequestId: target.relatedJoinRequestId,
          decision: mode === 'approve' ? 'APPROVE' : 'REJECT',
          ...(mode === 'approve' ? {assignedRole: role} : {}),
        });
        await notificationGateway.markRead(notificationId);
        removeNotification(notificationId);

### QA-021. 겹친 로그인 응답이 화면 계정과 저장 토큰을 서로 다른 사용자로 만들 수 있다

- 중요도: 심각 (P1)
- 위치: [LoginBottomSheet.tsx](../../frontend/src/features/auth/components/LoginBottomSheet.tsx#L62) visible effect·[handleSubmit](../../frontend/src/features/auth/components/LoginBottomSheet.tsx#L103), [App.tsx](../../frontend/App.tsx#L835) handleLogin(), [authGateway.ts](../../frontend/src/features/auth/api/authGateway.ts#L44) login(), [authSessionManager.ts](../../frontend/src/features/auth/session/authSessionManager.ts#L70) saveSession()
- 문제 내용: 제출 중 함수 guard가 없어 키보드 제출을 다시 호출할 수 있고 배경·Android Back도 계속 활성이다. sheet를 닫아 재열면 `submitting=false`로 초기화되어 다음 계정 제출도 가능하다. 두 로그인은 각각 App의 요청 세대 확인보다 먼저 `saveSession`을 실행한다. 첫 응답이 화면 사용자와 세대를 확정한 뒤 두 번째 응답이 저장소 토큰을 덮어쓰고 App 단계에서만 폐기될 수 있다. 닫은 단일 요청도 취소되지 않아 늦게 성공하면 사용자가 취소한 뒤 로그인된다.
- 사용자 재현: 느린 네트워크에서 계정 A를 제출하고 sheet를 닫아 계정 B로 다시 제출한다. 응답 순서에 따라 화면에는 A가 보이지만 이후 API는 B 토큰으로 실행되거나 그 반대가 되어 다른 가족 데이터 접근·예기치 않은 로그인으로 이어질 수 있다.
- 수정 가이드: UI에서 제출·닫기를 잠그는 것만으로 끝내지 말고, App이 발급한 최신 attempt ID/AbortSignal을 API와 세션 저장까지 전달해 최신 요청만 원자적으로 저장·적용한다.

        const attemptId = ++loginAttemptRef.current;
        const session = await authGateway.requestLogin(credentials, signal);
        if (attemptId !== loginAttemptRef.current || signal.aborted) return;
        await authSession.saveSession(session);
        if (attemptId !== loginAttemptRef.current) return;
        await enterAuthenticatedState(session.user);

### QA-022. 프로필 조회 실패·지연 중 fixture를 편집하면 실제 개인정보를 덮어쓴다

- 중요도: 심각 (P1)
- 위치: [MyPageScreen.tsx](../../frontend/src/features/profile/screens/MyPageScreen.tsx#L91) 초기 상태·[loadCurrentProfile](../../frontend/src/features/profile/screens/MyPageScreen.tsx#L124)·[handleProfileSave](../../frontend/src/features/profile/screens/MyPageScreen.tsx#L323), [CareReceiverMyPageScreen.tsx](../../frontend/src/features/profile/screens/CareReceiverMyPageScreen.tsx#L62), [ProfileEditScreen.tsx](../../frontend/src/features/profile/screens/ProfileEditScreen.tsx#L56)
- 문제 내용: 운영 경로도 보호자·피보호자 fixture로 먼저 렌더링하고 `/users/me` 실패 시 Alert만 띄운 채 편집을 허용한다. 느린 응답 전에 편집 화면에 들어가면 폼은 최초 fixture 값으로 고정되고 부모의 늦은 원격 갱신과 동기화되지 않는다. 저장은 이름·성별·생년월일 전체를 PATCH한다.
- 사용자 재현: 프로필 조회를 timeout시키거나 매우 느리게 만든 뒤 바로 편집·저장하면 예시 이름·생일·성별 또는 오래된 값으로 실제 계정 프로필이 바뀐다.
- 수정 가이드: 프로필을 `loading|ready|error`로 분리하고 `ready` 전에는 편집을 열지 않는다. 실패 화면에 재시도·뒤로 가기를 제공하고 fixture는 테스트 또는 `__DEV__`에서만 사용한다. 편집 중 원격 버전이 바뀌면 저장을 막거나 사용자가 수정한 필드만 병합한다.

        if (profileState.status !== 'ready') {
          return <ProfileLoadState onRetry={loadProfile} />;
        }
        return <MyPageProfileCard
          profile={profileState.profile}
          onEdit={() => setSubScreen('edit')}
        />;

### QA-023. 프로필 PATCH와 탈퇴가 겹치면 커밋된 탈퇴와 개인정보가 되살아난다

- 중요도: 심각 (P1)
- 위치: [UserService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/UserService.java#L81) updateMyProfile(), 같은 파일 [withdraw()](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/UserService.java#L126), [User.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/entity/User.java#L17)·[withdraw()](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/entity/User.java#L98)
- 문제 내용: PATCH는 활성 User를 잠금 없이 읽지만 탈퇴만 User row를 잠근다. PATCH가 먼저 읽고 탈퇴가 `withdrawn_at`과 개인정보 NULL을 커밋한 뒤 PATCH가 flush되면, `@Version`·`@DynamicUpdate`가 없는 stale 엔티티의 전체 UPDATE가 이전 `login_id`·`password_hash`·개인정보와 `withdrawn_at=NULL`을 다시 쓸 수 있다.
- 사용자 재현: 같은 계정을 두 기기에서 프로필 저장과 탈퇴로 동시에 요청하면 탈퇴가 204로 끝난 뒤 PATCH가 200을 반환하고 계정·개인정보가 복구될 수 있다.
- 수정 가이드: PATCH도 탈퇴와 같은 User row 잠금 순서를 사용하고 잠금 뒤 활성 상태를 재검증한다. 또는 `@Version`으로 stale UPDATE를 거부해 409로 변환한다.

        @Transactional
        public ProfileUpdateResponse updateMyProfile(Long userId, ProfileUpdateRequest request) {
          User user = getActiveUserForUpdate(userId);
          // 잠금 뒤 검증·수정·flush
        }

### QA-024. 그룹 생성과 탈퇴가 겹치면 탈퇴 계정이 유일 관리자인 고아 그룹이 생긴다

- 중요도: 심각 (P1)
- 위치: [GroupService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java#L94) create(), [UserService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/UserService.java#L126) withdraw()
- 문제 내용: 그룹 생성은 사용자의 활성 여부를 잠금 없이 확인한 뒤 새 그룹과 관리자 멤버십을 저장한다. 생성 트랜잭션이 활성 사용자를 읽은 다음 탈퇴가 사용자와 기존 멤버십만 잠그고 커밋하면, 생성 트랜잭션은 탈퇴 이후에도 새 활성 관리자 멤버십을 삽입할 수 있다. FK는 `withdrawn_at`이나 멤버십 활성 상태를 보장하지 않는다.
- 사용자 재현: 그룹 생성 요청을 지연시킨 상태에서 다른 기기로 탈퇴하면 둘 다 성공할 수 있고, 다시 인증할 수 없는 탈퇴자가 유일 관리자인 그룹이 남아 삭제·위임할 수 없다.
- 수정 가이드: 그룹 생성도 User row를 `FOR UPDATE`로 잠그고 탈퇴와 공통 lock order를 사용한다. 동일 원칙을 게시글·댓글·일정 생성의 활성 멤버십 검사에도 적용하고, 탈퇴 커밋 뒤 신규 활성 자원이 0개인지 동시성 테스트한다.

        User creator = userRepository.findActiveByIdForUpdate(authenticatedUserId)
          .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        FamilyGroup group = familyGroupRepository.save(...);
        groupMemberRepository.save(new GroupMember(group, creator, role, true, now));

### QA-032. 운영 프로필에서 정상 인증된 AI 통화 생성도 항상 401로 실패한다

- 중요도: 심각 (P1)
- 위치: [UnavailableCallActorResolver.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/UnavailableCallActorResolver.java#L7) profile·resolve(), [CallSessionService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/CallSessionService.java#L70) create(), [CallSessionController.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/controller/CallSessionController.java#L33) POST /call-sessions, [compose.prod.yml](../../infrastructure/production/compose.prod.yml#L10) 운영 profile
- 문제 내용: 운영은 `prod` profile을 사용하므로 `@Profile("!ai-call-dev")`인 `UnavailableCallActorResolver`가 유일한 `CallActorResolver`가 된다. Spring Security가 JWT를 인증해도 Controller는 principal을 Service에 전달하지 않고, Service는 73행에서 이 resolver를 호출한다. resolver는 사용자·멤버십을 읽지 않고 항상 `401 UNAUTHORIZED`를 던지므로 SDP 교환이나 DB 저장 전에 모든 운영 통화 생성이 종료된다.
- 사용자 재현: 정상 Access Token을 가진 활성 피보호자가 `POST /call-sessions`에 유효한 `persona_id`와 SDP offer를 보내도 매번 401을 받고 통화 화면을 시작할 수 없다.
- 수정 가이드: 운영용 resolver가 Spring Security의 `AuthenticatedUser`를 읽어 해당 사용자의 활성 `CARE_RECEIVER` 멤버십을 확정하도록 교체한다. 생성뿐 아니라 연결 결과·종료에서도 세션 소유권을 같은 actor 기준으로 검증하고, `ai-call-dev` fixture resolver는 개발 profile에만 유지한다. 기존 Jira `S15P11B104-214`의 수정 브랜치를 병합 전 검증한다.

```java
@Component
@Profile("!ai-call-dev")
final class JwtCallActorResolver implements CallActorResolver {
    public CallActor resolve() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
            || !(authentication.getPrincipal() instanceof AuthenticatedUser user)) {
            throw CallApiException.unauthorized("인증이 필요합니다.");
        }
        GroupMember member = groupMemberRepository
            .findActiveCareReceiverByUserId(user.id())
            .orElseThrow(() -> CallApiException.forbidden(
                "AI 전화는 피보호자만 사용할 수 있습니다."
            ));
        return new CallActor(member.getId());
    }
}
```

- 후속 검증 (2026-08-02, 병합 커밋 `8ba72e4` 기준):
  - 코드 대조: 병합된 `JwtCallActorResolver`가 수정 가이드와 일치한다. `@Profile("!ai-call-dev")`로 운영(`prod`) profile에서 유일한 `CallActorResolver`가 되고, SecurityContext의 `AuthenticatedUser`를 읽어 활성 `CARE_RECEIVER` 멤버십을 단건 확정하며(부분 유니크 인덱스 `uq_user_active_care_receiver` 전제), 미인증 401과 비피보호자 403을 구분한다. `UnavailableCallActorResolver`는 삭제되었다. `CallSessionService`는 생성·연결 결과·종료 모두 `resolve()`와 `findOwnedSessionForUpdate`로 같은 actor 기준 소유권을 검증한다.
  - 테스트: 단위 4건(정상 해석·미인증 401·principal 타입 불일치 401·비피보호자 403)과 통합 5건(피보호자 201, 이중 역할 사용자의 피보호자 멤버십 해석, 보호자 403, 탈퇴 피보호자 403, 미인증 401)이 resolver를 모킹하지 않고 `ai-call-dev` 비활성 조건에서 검증한다. 백엔드 전체 `cleanTest test --no-build-cache --offline` 실제 실행 결과 78 suites·593 tests 통과(failure 0·error 0·skipped 0, 1m 37s). 기존 76 suites·584 tests 대비 증가분은 214 추가 테스트 2 suites·9 tests와 정확히 일치한다.
  - 잔여: 운영과 동일한 staging 환경의 E2E(에뮬레이터 Phase 5·6 재실행 포함)는 미실행. 코드·테스트 수준 검증은 완료 상태다.

## P2 발견 사항

### QA-008. WebRTC 생성자 중간 실패 시 native 자원과 오디오 라우팅이 누수된다

- 중요도: 경고 (P2)
- 위치: [AiCallWebRtc.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallWebRtc.kt#L57) init, 같은 파일 close()
- 문제 내용: AudioDeviceModule, PeerConnectionFactory, AudioTrack과 통화용 오디오 라우팅을 순서대로 만든 뒤 PeerConnection 또는 DataChannel 생성이 실패할 수 있다. 생성자 자체가 실패하면 Runtime에 인스턴스가 대입되지 않아 close()를 호출할 수 없다.
- 영향: 실패 후 재시도에서 마이크 자원과 MODE_IN_COMMUNICATION 설정이 남거나 누적될 수 있다.
- 수정 가이드: init 전체를 try/catch로 감싸 이미 만들어진 자원을 역순 해제하고 라우팅을 복원한 뒤 예외를 다시 던진다.

        init {
          try {
            initializeWebRtc()
            configureAudioRoute()
            createPeerConnectionAndDataChannel()
          } catch (error: Throwable) {
            close()
            throw error
          }
        }

### QA-009. 일시적인 WebRTC DISCONNECTED를 즉시 통화 종료로 처리한다

- 중요도: 경고 (P2)
- 위치: [AiCallWebRtc.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallWebRtc.kt#L163) ICE 상태, 같은 파일 onConnectionChange(), [AiCallContent.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt#L157)
- 문제 내용: FAILED, CLOSED와 달리 DISCONNECTED는 Wi-Fi·모바일 데이터 전환 등에서 일시적으로 발생하고 다시 CONNECTED가 될 수 있다. 현재 코드는 두 상태 callback 모두에서 즉시 connection lost를 발생시키고 UI를 Failed로 바꾼 뒤 서버 통화를 종료한다.
- 영향: 짧은 네트워크 흔들림도 복구 불가능한 통화 종료로 확대된다.
- 수정 가이드: FAILED/CLOSED는 즉시 종료하되 DISCONNECTED에는 짧은 grace timer를 두고 CONNECTED/COMPLETED 복귀 시 취소한다.

        DISCONNECTED -> scheduleDisconnectGracePeriod()
        CONNECTED, COMPLETED -> {
          cancelDisconnectGracePeriod()
          markConnected()
        }
        FAILED, CLOSED -> notifyConnectionLostIfNeeded()

### QA-010. 동일 FCM 토큰 등록 경쟁이 최신 활성 토큰을 비활성화한다

- 중요도: 경고 (P2)
- 위치: [App.tsx](../../frontend/App.tsx#L557) registerCurrentDeviceToken()
- 문제 내용: 로그인 등록과 onNewToken 등록이 같은 토큰으로 겹치면 두 HTTP 요청이 실행된다. 최신 요청이 먼저 성공해 토큰을 활성 상태로 저장한 뒤 오래된 요청이 완료되면 stale 정리 코드가 같은 토큰을 서버에서 비활성화한다.
- 영향: 클라이언트는 토큰이 활성이라고 기억하지만 서버 행은 비활성이라 푸시가 조용히 중단된다.
- 수정 가이드: 토큰별 등록을 single-flight로 합치거나, stale 정리 전에 현재 활성·진행 토큰과 동일한지 확인한다.

        if (
          !pendingRegistration.deactivationRequested &&
          activeDeviceTokenRef.current !== token &&
          pendingDeviceTokenRegistrationRef.current?.token !== token
        ) {
          await gateway.deactivateDeviceToken(token);
        }

### QA-011. 리포트 화면이 대상 수에 비례한 2~3N 요청을 동시에 보내고 한 건 실패로 전체를 폐기한다

- 중요도: 경고 (P2)
- 위치: [useReportPages.ts](../../frontend/src/features/reports/hooks/useReportPages.ts#L48), [ReportScreen.tsx](../../frontend/src/features/reports/screens/ReportScreen.tsx#L99)
- 문제 내용: 피보호자마다 일간 리포트와 달력, 필요하면 최신 일간 리포트까지 요청한다. 모든 대상을 제한 없는 Promise.all로 동시에 시작하고 하나만 실패해도 성공한 모든 페이지를 버린다.
- 영향: 대규모 그룹에서 요청 폭주가 발생하며, 불안정한 네트워크에서는 한 대상의 장애가 전체 리포트 오류로 확대된다.
- 수정 가이드: 서버 배치 API가 최선이다. 당장 클라이언트에서 처리한다면 작은 chunk로 제한하고 Promise.allSettled로 성공 결과를 유지한다.

        for (const chunk of chunks(targets, 4)) {
          const results = await Promise.allSettled(chunk.map(loadReportPage));
          mergeSuccessfulPages(results);
          markFailedTargets(results);
        }

### QA-012. 전사 저장 실패 뒤 부분 전문으로 성공 리포트를 생성한다

- 중요도: 경고 (P2)
- 위치: [SidebandTranscriptHandler.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/SidebandTranscriptHandler.java#L123), [CallReportGenerationService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/report/CallReportGenerationService.java#L71)
- 문제 내용: 한 발화 저장이 실패하면 로그만 남기고 다음 발화를 계속 저장한다. 통화 종료 후 전문이 한 줄이라도 있으면 누락 여부를 모른 채 Gemini 리포트와 알림을 생성한다.
- 근거: [SidebandTranscriptHandlerTest.java](../../backend/src/test/java/com/ssafy/s15p11b104/domain/call/service/SidebandTranscriptHandlerTest.java#L128)가 첫 저장 실패 뒤 두 번째 발화만 저장하는 현재 동작을 고정한다.
- 영향: 보호자에게 완전한 분석처럼 보이는 부분 리포트가 전달될 수 있다.
- 수정 가이드: 저장 이벤트를 durable inbox로 재처리하거나 세션에 transcript_complete 상태를 두고, 누락이 있으면 reconciliation 전까지 리포트 생성을 막는다.

        catch (RuntimeException error) {
          transcriptIntegrityService.markIncomplete(callSessionId, itemId);
          throw error;
        }

        if (!transcriptIntegrityService.isComplete(callSessionId)) {
          return; // 재처리 완료 후 생성
        }

### QA-013. 22시 이후 건별 리포트 burst가 동일 일일 Gemini 분석을 중복 실행한다

- 중요도: 경고 (P2)
- 위치: [CallReportGenerationService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/call/report/CallReportGenerationService.java#L54), [DailyReportGenerationDispatcher.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/report/service/DailyReportGenerationDispatcher.java#L21), [DailyReportGenerationService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/report/service/DailyReportGenerationService.java#L58)
- 문제 내용: 22시 이후 완료된 각 건별 리포트가 동일 날짜 전체 일일 작업을 @Async로 실행한다. 각 작업은 일일 리포트 존재 검사 뒤 Gemini를 호출하고, 저장 직전에야 멤버 행을 잠근다.
- 영향: DB 중복 행은 막지만 동시에 시작된 작업 수만큼 전체 조회와 유료 AI 분석이 중복된다.
- 수정 가이드: reportDate와 memberId 기준 durable claim 또는 single-flight를 AI 호출 전에 획득하고 성공·실패 상태를 기록한다.

        if (!generationClaimRepository.tryClaim(reportDate, memberId)) {
          return;
        }
        try {
          generateAndSave(reportDate, memberId);
          generationClaimRepository.complete(reportDate, memberId);
        } catch (RuntimeException error) {
          generationClaimRepository.releaseForRetry(reportDate, memberId);
          throw error;
        }

### QA-014. 시작 시각 수정이 발송 완료 HOUR_BEFORE 이력을 삭제해 같은 슬롯을 재발송한다

- 중요도: 경고 (P2)
- 위치: [CalendarEventService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/calendar/service/CalendarEventService.java#L161), 같은 파일 cancelRemindersIfScheduleChanged(), [NotificationRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/notification/repository/NotificationRepository.java#L59)
- 문제 내용: HOUR_BEFORE 알림이 발송된 뒤 startAt을 수정하면 기존 HOUR_BEFORE EVENT_REMINDER 행을 삭제한다. 예를 들어 10:00 일정의 09:00 알림 발송 뒤 09:05에 시작을 11:00으로 바꾸면, 기존 push는 회수되지 않지만 unique 발송 이력이 사라져 10:00에 같은 일정·수신자·slot 알림이 다시 생성된다.
- 스펙 근거: [CALENDAR.md](../specs/domains/CALENDAR.md#L39), [NOTIFICATIONS.md](../specs/domains/NOTIFICATIONS.md#L111)는 시작 시각이 바뀌어도 같은 슬롯을 재생성하지 않도록 확정한다.
- 수정 가이드: 일정 수정 시 발송 ledger를 삭제하지 않는다. 아직 생성 전인 미래 알림은 행이 없으므로 별도 취소 삭제가 필요하지 않다.

        event.update(...);
        replaceParticipants(event, participants);
        // 이미 발송된 EVENT_REMINDER 행은 중복 방지 ledger로 보존한다.

### QA-015. 리마인더 스케줄러가 매분 무제한 후보와 2N+1 쿼리를 처리한다

- 중요도: 경고 (P2)
- 위치: [EventReminderScheduler.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/notification/service/EventReminderScheduler.java#L19), [EventReminderService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/notification/service/EventReminderService.java#L95), [CalendarEventRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/calendar/repository/CalendarEventRepository.java#L34)
- 문제 내용: 최근 1시간을 포함한 후보 전체를 List로 읽고 일정마다 활성 멤버와 참여자를 각각 조회한다. 수신자별 insert도 개별 수행하며, unique 제약은 같은 후보를 다음 분에 다시 읽는 비용을 막지 못한다.
- 영향: 같은 시각 일정이 많거나 장애 복구 구간에 들어오면 최소 1+2N 조회와 수신자 수만큼 쓰기가 매분 반복된다. 현재 인덱스도 전역 예정 시각 조회에 최적화되어 있지 않다.
- 수정 가이드: keyset/page 크기를 제한하고 eventIds·groupIds 단위로 참여자와 활성 멤버를 일괄 조회한다. start_at 또는 전역 event_date 인덱스는 EXPLAIN ANALYZE로 확인 후 추가한다.

        Slice<CalendarEvent> candidates =
          repository.findReminderCandidates(now, PageRequest.of(0, batchSize));
        Map<Long, Set<Long>> participants = participantRepository.findMapByEventIds(ids);
        Map<Long, List<GroupMember>> members = memberRepository.findActiveMapByGroupIds(groupIds);

### QA-016. 그룹 삭제와 가입 승인이 직렬화되지 않아 승인된 구성원이 함께 삭제될 수 있다

- 중요도: 경고 (P2)
- 위치: [GroupService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupService.java#L152), [JoinRequestService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/JoinRequestService.java#L102)
- 문제 내용: 삭제는 활성 멤버 수가 1인지 확인한 뒤 가입 요청·멤버·그룹을 일괄 삭제한다. 승인은 가입 요청 행만 잠그고 그룹 행은 잠그지 않는다. 삭제의 인원 확인 뒤 승인이 커밋되면 삭제의 후속 bulk delete가 새 멤버까지 지울 수 있다.
- 영향: 승인 200과 삭제 204가 모두 성공했지만 승인된 멤버십과 그룹이 사라지는 write-skew가 가능하다.
- 수정 가이드: 그룹 삭제, 가입 요청 생성·결정이 모두 그룹 행을 같은 순서로 비관적 잠금한 뒤 권한·상태·활성 인원 수를 다시 확인한다.

        @Lock(LockModeType.PESSIMISTIC_WRITE)
        @Query("select g from FamilyGroup g where g.id = :groupId")
        Optional<FamilyGroup> findByIdForUpdate(Long groupId);

### QA-017. 동시 일정 전체 갱신이 참여자 교체 의미를 깨거나 500을 반환한다

- 중요도: 경고 (P2)
- 위치: [CalendarEventService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/calendar/service/CalendarEventService.java#L151), 같은 파일 replaceParticipants(), [EventParticipantRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/calendar/repository/EventParticipantRepository.java#L28)
- 문제 내용: 작성자와 관리자가 동시에 서로 다른 참여자 목록으로 PATCH하면 둘 다 기존 행을 삭제한 뒤 각 목록을 삽입한다. 일정 aggregate 행에는 비관적 잠금이나 @Version이 없다.
- 영향: 기존 목록이 비어 있거나 두 DELETE가 상대 INSERT보다 먼저 보이는 순서에서는 두 목록의 합집합이 남을 수 있다. 다른 순서에서는 한 요청의 목록이 사라지는 lost update가 되고, 겹치는 참여자는 unique 위반 500이 될 수 있다. 스칼라 필드와 참여자 목록도 서로 다른 요청 결과가 될 수 있다.
- 수정 가이드: 일정 수정·삭제 시 calendar_events 행을 FOR UPDATE로 조회하거나 @Version으로 충돌을 검출하고 명시적인 409를 반환한다.

        CalendarEvent event = eventRepository.findByIdForUpdate(eventId)
          .orElseThrow(CalendarApiException::notFound);
        event.update(...);
        replaceParticipants(event, requestedParticipants);

### QA-018. 관심사 동시 PUT이 전체 교체가 아니라 합집합이 되어 10개 제한을 우회한다

- 중요도: 경고 (P2)
- 위치: [MemberInterestService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/MemberInterestService.java#L49), [MemberInterestRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/repository/MemberInterestRepository.java#L23)
- 문제 내용: 빈 목록에 서로 다른 10개 목록을 동시에 PUT하면 두 트랜잭션의 DELETE는 0건이고 각자 10개씩 삽입할 수 있다. 겹치는 문자열은 unique 위반으로 한 요청이 500이 된다.
- 영향: 최종 20개가 남아 0~10개 전체 교체 계약을 위반하거나 정상 입력이 서버 오류로 끝난다.
- 수정 가이드: 대상 GroupMember 행을 먼저 잠그고 본인·활성 멤버 검증 뒤 삭제와 삽입을 수행한다.

        GroupMember member = memberRepository.findByIdForUpdate(memberId)
          .orElseThrow(GroupApiException::memberNotFound);
        validateOwner(member, currentUserId);
        interestRepository.deleteAllByMemberId(memberId);
        interestRepository.saveAll(toEntities(member, normalizedInterests));

### QA-019. 검사 후 쓰기 경쟁이 계약상 409 대신 DB 예외 500을 노출한다

- 중요도: 경고 (P2)
- 위치: [JoinRequestService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/JoinRequestService.java#L56), 같은 파일 피보호자 승인, [GroupMemberService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/group/service/GroupMemberService.java#L105), [V1__create_schema.sql](../../backend/src/main/resources/db/migration/V1__create_schema.sql#L71), [GlobalExceptionHandler.java](../../backend/src/main/java/com/ssafy/s15p11b104/global/exception/GlobalExceptionHandler.java#L28)
- 문제 내용: 동일 사용자의 동시 가입 요청은 양쪽 사전 exists 검사를 통과한 뒤 pending unique에서 한쪽이 실패한다. 서로 다른 그룹의 동시 피보호자 지정도 양쪽 사전 검사를 통과한 뒤 active care receiver unique에서 한쪽이 실패한다. 해당 DataIntegrityViolationException을 계약 오류로 바꾸는 처리가 없다.
- 영향: 데이터 중복은 DB가 막지만 API는 JOIN_REQUEST_ALREADY_EXISTS 또는 CARE_RECEIVER_ALREADY_ACTIVE_IN_OTHER_GROUP 409 대신 500을 반환한다.
- 수정 가이드: 사용자·그룹 단위 공통 잠금으로 검사와 쓰기를 직렬화한다. 마지막 방어로 saveAndFlush의 정확한 제약 위반만 해당 409 오류로 변환한다.

        try {
          repository.saveAndFlush(entity);
        } catch (DataIntegrityViolationException error) {
          if (constraintMatcher.isPendingJoinRequest(error)) {
            throw GroupApiException.joinRequestAlreadyExists();
          }
          if (constraintMatcher.isActiveCareReceiver(error)) {
            throw GroupApiException.careReceiverAlreadyActiveInOtherGroup();
          }
          throw error;
        }

### QA-025. 읽지 않은 개수 API 한 건의 실패가 정상 알림 목록까지 빈 화면으로 만든다

- 중요도: 경고 (P2)
- 위치: [NotificationsScreen.tsx](../../frontend/src/features/notifications/screens/NotificationsScreen.tsx#L90) 초기 load effect
- 문제 내용: 기존 목록을 먼저 비운 뒤 `loadPage(0)`과 `getUnreadCount()`를 하나의 `Promise.all`로 기다린다. 목록 응답이 성공해도 unread-count가 timeout·5xx이면 성공 결과를 버리고 오류만 표시한다.
- 사용자 재현: 알림 목록 API는 정상이고 badge API만 불안정한 상황에서 알림 화면에 들어가면 읽어야 할 가입 요청·리포트까지 모두 사라진 것처럼 보인다.
- 수정 가이드: 목록과 badge를 독립 상태로 처리한다. 목록 성공은 즉시 표시하고 count 실패는 현재 목록으로 계산한 fallback badge와 개별 재시도를 제공한다.

        const [pageResult, countResult] = await Promise.allSettled([
          gateway.loadPage(0),
          gateway.getUnreadCount(),
        ]);
        if (pageResult.status === 'fulfilled') setNotifications(pageResult.value.notifications);
        if (countResult.status === 'fulfilled') setServerUnreadCount(countResult.value);

### QA-026. 닫거나 뒤로 간 생성·가입·회원가입 요청의 늦은 성공이 새 화면에 적용된다

- 중요도: 경고 (P2)
- 위치: [GroupBottomSheet.tsx](../../frontend/src/features/auth/components/GroupBottomSheet.tsx#L79), [CreateGroupSheet.tsx](../../frontend/src/features/auth/components/CreateGroupSheet.tsx#L35)·[handleSubmit](../../frontend/src/features/auth/components/CreateGroupSheet.tsx#L46), [JoinGroupSheet.tsx](../../frontend/src/features/auth/components/JoinGroupSheet.tsx#L52), [App.tsx](../../frontend/App.tsx#L1121), [SignupFlowScreen.tsx](../../frontend/src/features/auth/screens/SignupFlowScreen.tsx#L137)·[handleSubmit](../../frontend/src/features/auth/screens/SignupFlowScreen.tsx#L216)
- 문제 내용: 그룹 sheet의 backdrop·Android Back과 회원가입의 이전 단계가 요청 중에도 활성이고, 요청에는 abort나 세대 검사가 없다. sheet를 닫아 재열면 submitting 상태까지 초기화된다. 이전 성공이 도착하면 새 sheet를 닫고 예전 그룹을 현재 그룹으로 만들거나, 이전 단계에 있던 회원가입을 완료 화면으로 강제 이동시킨다.
- 사용자 재현: 느린 네트워크에서 그룹 생성/가입 또는 회원가입 제출 후 뒤로 가고 다른 입력을 시작한다. 첫 요청의 늦은 성공으로 취소했다고 생각한 그룹·계정이 생성되고 현재 새 입력 화면도 사라진다.
- 수정 가이드: 제출 중 닫기를 명시적으로 막거나 확인 dialog를 제공하고, 요청마다 generation/AbortSignal을 두어 닫기·재열기·뒤로 가기 뒤의 응답은 UI에 적용하지 않는다. 서버 생성 명령에는 idempotency key도 적용한다.

        const requestId = ++requestGenerationRef.current;
        const result = await onSubmit(input, abortController.signal);
        if (requestId !== requestGenerationRef.current || !visibleRef.current) return;
        applyResult(result);

### QA-027. 댓글 등록·수정의 중복 탭 guard가 비동기 요청 시작 직후 풀린다

- 중요도: 경고 (P2)
- 위치: [PostDetailScreen.tsx](../../frontend/src/features/feed/screens/PostDetailScreen.tsx#L37) callback 타입·[handleSubmit](../../frontend/src/features/feed/screens/PostDetailScreen.tsx#L109), [FeedScreen.tsx](../../frontend/src/features/feed/screens/FeedScreen.tsx#L481) create·[update](../../frontend/src/features/feed/screens/FeedScreen.tsx#L527)
- 문제 내용: `isSubmitting.current=true`를 설정하지만 callback 타입이 `void`이고 await하지 않아 `finally`에서 즉시 false가 된다. 실제 네트워크 요청은 FeedScreen에서 fire-and-forget으로 계속 실행된다.
- 사용자 재현: 지연 중 등록 버튼이나 키보드 전송을 연속 입력하면 같은 댓글 POST가 여러 번 전송되거나 수정 PATCH 응답 순서에 따라 오래된 내용이 마지막에 남는다.
- 수정 가이드: mutation callback을 `Promise<void>`로 통일해 await하고, 완료까지 state 기반으로 입력·버튼을 비활성화한다. 생성 API에는 중복 요청 방어용 idempotency key를 추가한다.

        const handleSubmit = async () => {
          if (!canSubmit || submitting) return;
          setSubmitting(true);
          try {
            await (editingComment ? onUpdateComment(input) : onCreateComment(input));
            resetComposer();
          } finally {
            setSubmitting(false);
          }
        };

### QA-028. 회원가입에서 선택해 미리 본 프로필 사진이 완료 시 전부 유실된다

- 중요도: 경고 (P2)
- 위치: [SignupFlowScreen.tsx](../../frontend/src/features/auth/screens/SignupFlowScreen.tsx#L149) 이미지 선택·[handleSubmit](../../frontend/src/features/auth/screens/SignupFlowScreen.tsx#L216), [signupApi.ts](../../frontend/src/features/auth/api/signupApi.ts#L11), 계약 [API.md](../specs/contracts/API.md#L83)
- 문제 내용: `프로필 사진은 나중에 등록해도 돼요`라는 선택 사항 UI에서 사용자가 실제 사진을 고르면 draft와 미리보기에는 반영되지만 가입 입력 타입과 POST payload에는 이미지가 없다. 저장되지 않는다는 안내도 없고 가입 완료 뒤 인증된 업로드·프로필 PATCH 경로도 연결하지 않는다. API 계약에 회원가입 이미지 필드가 없다는 사실이 이미 노출된 선택값을 조용히 버리는 UI를 정당화하지는 않는다.
- 사용자 재현: 사진을 선택해 화면에서 확인한 뒤 회원가입을 완료하면 프로필에는 기본 이미지가 표시되고 선택 사실이나 후속 안내가 없다.
- 수정 가이드: 현재 계약을 유지한다면 가입 화면에서 이미지 선택을 제거하고 인증 후 프로필 단계에서 받는다. 가입 중 선택을 유지하려면 가입 완료·로그인 직후 인증된 업로드와 `/users/me` PATCH까지 하나의 명시적 onboarding 단계로 연결하고 실패 재시도를 제공한다.

        const signup = await gateway.signup(baseInput);
        onComplete({
          signup,
          pendingProfileImageUri: draft.profileImageUri,
        }); // 인증 완료 단계가 upload + PATCH를 책임진다.

### QA-029. 피드·댓글 페이지 경계가 계약을 거부하지 않고 대량·불안정 정렬을 허용한다

- 중요도: 경고 (P2)
- 위치: [PostReadController.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/PostReadController.java#L31), [CommentController.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/CommentController.java#L38), [PostRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/repository/PostRepository.java#L15), [CommentRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/repository/CommentRepository.java#L16), 계약 [API.md](../specs/contracts/API.md#L68)
- 문제 내용: controller는 검증 없는 Spring `Pageable`을 그대로 받는다. 현재 Spring Data resolver는 음수 page를 0으로 보정하고 size를 최대 2000까지 허용하지만 계약은 음수·1~100 밖·sort를 400으로 거부한다. 저장소 정렬도 createdAt만 있어 같은 timestamp의 id tie-break가 없고 외부 sort가 추가될 수 있다.
- 사용자 재현: `?page=-1`, `?size=2000`, `?sort=unknown`이 각각 첫 페이지·대량 조회·서버 예외로 처리될 수 있다. 같은 시각에 글·댓글이 몰리면 페이지를 넘길 때 항목이 중복되거나 빠진다.
- 수정 가이드: page·size·sort를 명시적으로 검증해 계약 오류로 변환하고 외부 sort를 차단한다. JPQL 정렬은 피드 `createdAt DESC, id DESC`, 댓글 `createdAt ASC, id ASC`로 고정한다.

        if (page < 0 || size < 1 || size > 100 || request.getParameter("sort") != null) {
          throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        // order by post.createdAt desc, post.id desc

### QA-030. Android 시스템 Back이 내부 이전 화면 대신 앱을 종료한다

- 중요도: 경고 (P2)
- 위치: [MainActivity.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/MainActivity.kt#L8), [SignupFlowScreen.tsx](../../frontend/src/features/auth/screens/SignupFlowScreen.tsx#L279), [FeedScreen.tsx](../../frontend/src/features/feed/screens/FeedScreen.tsx#L819), [MyPageScreen.tsx](../../frontend/src/features/profile/screens/MyPageScreen.tsx#L358), [GroupInfoScreen.tsx](../../frontend/src/features/group-info/screens/GroupInfoScreen.tsx#L672)
- 문제 내용: 여러 화면이 React state로 하위 화면을 전환하고 header 버튼만 `onBack`에 연결한다. MainActivity는 기본 ReactActivity이고 공통 JS `BackHandler`가 없다. 작성 화면 일부를 제외하면 Android hardware/gesture Back은 로컬 화면을 pop하지 않고 Activity 기본 종료로 이어진다.
- 동적 재현: `emulator-5554`에서 welcome → 회원가입 1/5 진입 → 시스템 Back 실행 후 `topResumedActivity`가 Familink가 아닌 `NexusLauncherActivity`로 바뀌었다. crash buffer는 비어 있어 crash가 아니라 잘못된 navigation이다.
- 수정 가이드: modal → 하위 화면 → 수정 중 확인 → 앱 종료 순서의 공통 Back 정책을 구현한다. 각 화면 listener는 처리했을 때 `true`를 반환하고 unmount 시 제거한다.

        useEffect(() => {
          const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (subScreen === null) return false;
            closeSubScreen();
            return true;
          });
          return () => subscription.remove();
        }, [subScreen]);

### QA-031. 마이크 권한 영구 거부를 네트워크 오류로 표시해 복구할 수 없다

- 중요도: 경고 (P2)
- 위치: [AiCallContent.kt](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt#L137) permission launcher·[권한 결과](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt#L201), 같은 파일 [CallFailedScreen](../../frontend/android/app/src/main/java/com/s15p11b104app/aicall/AiCallContent.kt#L876)
- 문제 내용: RECORD_AUDIO 결과를 Boolean으로만 받아 거부하면 일반 Failed로 보낸다. 실패 화면은 인터넷 연결만 확인하라고 하고 재시도만 제공한다. `NEVER_ASK_AGAIN` 또는 설정에서 차단된 상태를 구분하거나 앱 설정으로 이동하는 경로가 없다.
- 사용자 재현: 마이크 권한을 영구 거부한 뒤 AI 전화를 재시도하면 권한 dialog가 다시 뜨지 않고 같은 네트워크 오류 화면만 반복된다.
- 수정 가이드: 최초 거부·설명 필요·영구 차단을 별도 상태로 모델링한다. 영구 차단에는 마이크 전용 설명과 `ACTION_APPLICATION_DETAILS_SETTINGS` 버튼을 제공하고 foreground 복귀 시 권한을 재확인한다.

        val settingsIntent = Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${context.packageName}"),
        )
        context.startActivity(settingsIntent)

### QA-033. 외부 프로필 이미지 URL이 검증 없이 저장되어 다른 사용자의 기기가 공격자 서버에 접속한다

- 중요도: 경고 (P2)
- 위치: [ProfileUpdateRequest.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/dto/ProfileUpdateRequest.java#L47) profileImageUrl 형식, [UserService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/UserService.java#L81) updateMyProfile(), [UserApiTest.java](../../backend/src/test/java/com/ssafy/s15p11b104/domain/account/UserApiTest.java#L143) 외부 URL 허용 테스트, [ACCOUNT_AND_PROFILE.md](../specs/domains/ACCOUNT_AND_PROFILE.md#L83) 저장 전 검증 규칙
- 문제 내용: DTO는 URL을 500자 이하의 비공백 문자열로만 제한하고, Service는 host·object key·스토리지 metadata 검증 없이 그대로 `users.profile_image_url`에 저장한다. 현재 테스트도 `https://example.com/a.png`를 정상 저장하는 동작을 고정한다. 이는 허용 S3/CDN host, `profile-image/` prefix, 이미지 MIME, 10 MiB 상한을 저장 전에 검증하라는 공식 스펙과 반대다.
- 사용자 재현: 인증 사용자가 자신의 `profileImageUrl`을 공격자가 운영하는 HTTPS 주소로 PATCH한 뒤 다른 그룹 구성원이 프로필이나 알림을 열면, 그 기기가 공격자 origin에 직접 이미지 요청을 보내 IP·User-Agent 등 네트워크 식별 정보를 노출한다. 대용량·비정상 이미지로 네트워크와 렌더링 자원도 소비시킬 수 있다.
- 수정 가이드: `null` 삭제를 제외한 문자열은 허용 host와 `profile-image/` object key를 먼저 검증하고, S3 `HeadObject`의 실제 MIME과 10 MiB 상한을 확인한 뒤 저장한다. 외부 host·다른 prefix·비이미지·초과 크기를 400으로 거부하는 회귀 테스트로 기존 `example.com` 허용 기대를 교체한다.

```java
if (request.profileImageUrlProvided() && request.profileImageUrl() != null) {
    profileImageValidator.validate(request.profileImageUrl());
}
user.updateProfileImageUrl(request.profileImageUrl());
```

## 보안 발견 사항

아래 8건을 이 통합 리포트의 보안 QA 결과로 관리한다. 범위·위협 모델·검토 표면은 [한글 보안 QA 보고서](./2026-08-02-security-scan-ko.md), 원문 증거는 [봉인된 영문 원본](./2026-08-02-security-scan.md)에서 대조한다. 영문 원본의 `findings/...` 링크가 가리키는 scan-local write-up·PoC는 프로젝트에 복사하지 않았다. 후속 교차검증에서 추가한 QA-032·033은 봉인된 보안 스캔 8건 집계에는 포함하지 않고 코드 QA 집계에 반영했다.

<a id="sec-001"></a>

### SEC-001. 릴리스 빌드가 저장소에 노출된 Android debug 서명키를 사용한다

- 중요도: 심각 (High)
- 위치: [build.gradle](../../frontend/android/app/build.gradle#L116) release signing 설정, `frontend/android/app/debug.keystore` (관련 설정 범위 100~116행)
- 문제 내용: release 빌드가 `signingConfigs.debug`를 사용하고, 해당 개인키 파일도 저장소에 추적되어 있다. `:app:assembleRelease --offline`으로 새 APK를 만든 뒤 `apksigner verify --print-certs`를 실행한 결과 실제 `app-release.apk`의 인증서가 `CN=Android Debug`였고, debug APK와 SHA-256 지문 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`까지 같았다.
- 영향: 이 인증서로 배포된 앱을 사용자가 설치한 상태에서 공격자가 APK 전달 경로를 확보하면 같은 package의 위조 업데이트를 서명해 앱 데이터와 권한을 승계할 수 있다. 외부 배포 단계에서 재서명하더라도 저장소와 CI가 이를 강제하지 않는다.
- 수정 가이드: 보호된 release keystore와 비밀번호를 CI secret으로만 주입하고, 값이 없거나 debug 인증서이면 release task를 실패시킨다. 배포 APK/AAB의 최종 인증서 fingerprint도 CI에서 검증한다.

```gradle
android.applicationVariants.all { variant ->
    if (variant.buildType.name == "release" &&
        variant.signingConfig?.name == "debug") {
        throw new GradleException("Release build must not use debug signing")
    }
}
```

<a id="sec-002"></a>

### SEC-002. presigned upload 요청의 파일 batch 개수에 상한이 없다

- 중요도: 경고 (Medium)
- 위치: [PresignedUrlRequest.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/file/dto/PresignedUrlRequest.java#L11), [FileUploadService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/FileUploadService.java#L20)
- 문제 내용: 인증 사용자가 비어 있지 않은 `files[]`를 보내면 개수 제한 없이 전체 검증 후 각 항목마다 S3 presigned URL을 생성하고 응답에 유지한다. 프록시 요청 본문 제한 안에서도 수만 개의 작은 항목을 구성할 수 있다.
- 영향: 한 요청으로 CPU, heap, 요청 thread, S3 서명 연산과 응답 직렬화를 과도하게 소비해 가용성을 낮출 수 있다.
- 수정 가이드: 목적별 최소 상한을 DTO의 `@Size(max=...)`로 iteration 전에 강제하고, 사용자별 발급 quota·rate limit·동시 요청 제한을 함께 둔다.

```java
public record PresignedUrlRequest(
    @NotEmpty @Size(max = 10) List<@Valid FileItem> files
) {}
```

<a id="sec-003"></a>

### SEC-003. presigned upload 정책 우회로 임의 purpose·MIME·대용량 객체가 가능하다

- 중요도: 경고 (Medium)
- 위치: [FileUploadService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/FileUploadService.java#L20), [MediaUploadPolicy.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/MediaUploadPolicy.java#L24), [S3PresignedUploadProvider.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/file/service/S3PresignedUploadProvider.java#L30)
- 문제 내용: 지원하지 않는 purpose·MIME과 선언 크기가 일부 경로에서 우회되고, purpose가 객체 key prefix로 사용된다. 실제 PUT body 크기도 요청에서 선언한 크기에 묶이지 않는다. `MediaUploadPolicyTest.keepsNonPostMediaPurposeCompatible`도 `avatar` purpose와 `application/pdf`가 예외 없이 통과하는 현재 동작을 명시적으로 확인한다.
- 영향: 의도하지 않은 namespace에 대용량·고아 객체를 생성해 저장 공간과 요청 예산을 소모할 수 있다. 이번 점검에서 타 사용자 객체 읽기나 신뢰 출처의 스크립트 실행까지는 입증하지 않았다.
- 수정 가이드: 알 수 없는 purpose를 기본 거부하고 purpose별 개수·MIME·크기를 서명 전에 검증한다. 저장소 계층에서도 실제 body 크기를 강제하고 소유자 quota와 고아 객체 정리를 적용한다.

```java
UploadPolicy policy = policies.get(request.purpose());
if (policy == null) {
    throw new BadRequestException("Unsupported upload purpose");
}
policy.validate(request.files());
```

<a id="sec-004"></a>

### SEC-004. 운영 인증 트래픽이 cleartext HTTP로 노출된다

- 중요도: 경고 (Medium)
- 위치: [compose.prod.yml](../../infrastructure/production/compose.prod.yml#L96), [api.conf](../../infrastructure/production/nginx/conf.d/api.conf#L5), [AWS foundation README](../../infrastructure/aws-foundation/README.md#L64)
- 문제 내용: 운영 compose는 공개 80 포트를 열고 Nginx는 HTTP listener만 구성한다. 443 포트에 대응하는 listener·인증서가 없고 80에서 HTTPS redirect도 하지 않는다.
- 영향: 경로상 공격자가 로그인 비밀번호와 access·refresh token을 탈취·재사용하거나 응답을 변조할 수 있다. 앱이 HTTP를 거부하더라도 공개 API 자체의 노출은 해소되지 않는다.
- 수정 가이드: 첫 신뢰 ingress에서 TLS를 종료하고 80은 폐쇄하거나 HTTPS redirect 전용으로 둔다. origin의 직접 cleartext 접근을 차단하고 실제 배포 환경에서 인증서와 HTTPS-only 동작을 검증한다.

```nginx
server { listen 80; return 301 https://$host$request_uri; }
server { listen 443 ssl; /* managed certificate and secure proxy */ }
```

<a id="sec-005"></a>

### SEC-005. 공개 로그인에 BCrypt 이전 시도 제한이 없다

- 중요도: 경고 (Medium)
- 위치: [SecurityConfig.java](../../backend/src/main/java/com/ssafy/s15p11b104/global/security/SecurityConfig.java#L24), [AuthController.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/controller/AuthController.java#L85), [AuthService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/account/service/AuthService.java#L97)
- 문제 내용: 인증되지 않은 호출자가 횟수·지연·잠금 제한 없이 로그인 요청을 반복할 수 있고, 매번 DB 조회와 BCrypt 검증에 도달한다. 확인 가능한 애플리케이션·프록시 설정에는 선행 제한이 없다.
- 영향: 온라인 비밀번호 추측에 의한 계정 탈취와 BCrypt CPU·DB 부하를 결합한 가용성 저하가 가능하다.
- 수정 가이드: DB·BCrypt 전에 계정과 source를 함께 고려하는 원자적·다중 replica 공유 rate limit을 두고, 지수 backoff, `429 Retry-After`, 입력 길이 상한을 적용한다.

```java
loginAttemptGuard.checkAndConsume(loginId, clientAddress);
// 통과한 요청만 사용자 조회와 passwordEncoder.matches() 수행
```

<a id="sec-006"></a>

### SEC-006. 게시글 생성이 무제한 groupIds로 fan-out 된다

- 중요도: 단순개선 (Low)
- 위치: [PostCreateRequest.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/dto/PostCreateRequest.java#L13), [PostService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostService.java#L64)
- 문제 내용: 활성 구성원이 제한 없는 distinct `groupIds`를 보내면 각 그룹마다 membership 검사, 게시글·미디어·카네이션·이벤트 처리를 한 transaction에서 fan-out하고 알림도 증폭한다.
- 영향: 그룹 수에 비례해 DB, heap, transaction 시간과 event 처리량이 커진다. 인가 우회는 아니며 공격자가 많은 그룹에 가입해야 한다는 제약이 있다.
- 수정 가이드: 서버에서 `groupIds`의 hard max를 강제하고 사용자별 그룹 수·요청 예산도 제한한다. 알림 fan-out은 크기가 제한된 비동기 queue로 분리한다.

```java
@Size(min = 1, max = 20)
List<@NotNull Long> groupIds
```

<a id="sec-007"></a>

### SEC-007. 실패한 AI 게시글 분석을 무제한 batch로 매분 재시도한다

- 중요도: 단순개선 (Low)
- 위치: [PostAnalysisRepository.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/repository/PostAnalysisRepository.java#L19), [PostAnalysisService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisService.java#L47), [PostAnalysisScheduler.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostAnalysisScheduler.java#L20)
- 문제 내용: non-SUCCESS 게시글을 pagination 없이 모두 조회하고 한 transaction에서 처리한다. 실패 row는 재시도 횟수·backoff·dead-letter 없이 매분 다시 선택된다.
- 영향: 지속적인 외부 AI 장애와 backlog가 결합되면 AI quota와 DB transaction 용량을 반복 소모한다.
- 수정 가이드: 재시도 가능·영구 실패를 분리하고 최대 횟수, 지수 backoff와 jitter, batch hard limit을 둔다. claim과 결과 저장 transaction을 짧게 분리하고 다중 instance lease를 적용한다.

```java
PageRequest batch = PageRequest.of(0, 100);
// nextAttemptAt <= now, attempts < maxAttempts 조건으로 claim
```

<a id="sec-008"></a>

### SEC-008. 그룹 보관함이 페이지 없이 모든 게시글·미디어를 적재한다

- 중요도: 단순개선 (Low)
- 위치: [PostReadController.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/controller/PostReadController.java#L50), [PostReadService.java](../../backend/src/main/java/com/ssafy/s15p11b104/domain/feed/service/PostReadService.java#L98)
- 문제 내용: 보관함 route가 `Pageable.unpaged()`로 전체 게시글을 materialize하고, 모든 media를 bulk load한 뒤 일부 filter를 메모리에서 적용해 전체 응답을 직렬화한다.
- 영향: 그룹 이력이 커질수록 DB 조회, heap, mapping과 응답 직렬화 비용이 무제한 증가하며 반복 호출로 가용성이 저하될 수 있다.
- 수정 가이드: cursor 또는 page 방식과 서버 hard max를 적용하고, filter를 DB query로 내려 media 조회·grouping 전에 결과 집합을 제한한다.

```java
Pageable bounded = PageRequest.of(page, Math.min(size, 100), sort);
return postReadService.getArchive(groupId, bounded, filters);
```

## 실행 검증 결과

### 통과

- 백엔드 테스트 결과 XML: 76 suites, 584 tests, failure 0, error 0, skipped 0
- 백엔드 bootJar 결과물: backend/build/libs/backend-0.0.1-SNAPSHOT.jar 생성 확인
- 프론트엔드 전체 Jest: 75 suites, 539 tests 통과
- 사용자 특수 케이스 관련 프론트 회귀 재실행: 6 suites, 48 tests 통과(알림·프로필·회원가입·피드); 신규 늦은 응답·중복 탭·Back interleaving은 기존 테스트에 없음
- 독립 read-only 리뷰 2회: 신규 프론트·Android와 백엔드 동시성 근거 재대조 완료; 미결정인 일일 리포트 재시작 backfill은 결함 집계에서 제거
- 프론트엔드 typecheck: 통과
- 프론트엔드 lint: 오류 0, 경고 26
- app-shell 검증: 6/6 통과
- Android dev 검증: 6/6 통과
- Android JVM 테스트: 2 suites, 4 tests 통과
- Debug APK: frontend/android/app/build/outputs/apk/debug/app-debug.apk 생성 확인
- 외부 보고서 집중 백엔드 회귀: `UserApiTest` 22건, `MediaUploadPolicyTest` 4건, `CallSessionServiceTest` 4건 등 3 suites·30 tests 통과. 통과 결과에는 외부 프로필 URL과 임의 purpose 허용이라는 현재의 잘못된 기대도 포함되므로 결함 반증이 아니다.
- Release APK: `:app:assembleRelease --offline` BUILD SUCCESSFUL, 421 tasks 중 34개 실행·387개 up-to-date. 새 `app-release.apk`의 v2 서명 검증 통과 및 `CN=Android Debug`·debug APK와 동일한 SHA-256 지문 확인
- npm ci --dry-run --ignore-scripts: lockfile 일치
- Android emulator-5554: 앱 welcome·로그인 modal 정상 표시, 가로 회전과 시스템 글꼴 200%에서 주요 입력·버튼 노출, crash buffer 비어 있음, 네트워크 설정 원복과 최종 앱 foreground 복구 확인
- Android 시스템 Back 재현: 회원가입 1/5에서 Back 입력 후 `topResumedActivity=NexusLauncherActivity`로 전환되어 QA-030 확정

백엔드 전체 테스트는 최종 오프라인 재실행에서 2분 39초 만에 BUILD SUCCESSFUL로 종료됐고 76 suites·584 tests를 다시 집계했다. 동시에 겹친 중복 재실행 한 건은 test-results의 output.bin 파일 잠금으로 시작 전에 실패했으나, 선행 전체 실행의 성공 결과와는 분리했다. Android는 새로 생성된 XML·APK의 시각과 집계 결과를 확인했다.

### 미통과 또는 미실행 — 제품 결함과 분리

- 운영 환경 파일: release 빌드는 성공했지만 `frontend/.env.production`이 없다는 경고를 출력했고 example은 CI/CD가 HTTPS API URL을 주입한다고 설명한다. 실제 배포 secret·환경변수 주입은 이 체크아웃만으로 확인할 수 없다.
- npm audit --omit=dev: critical 0, high 1, moderate 7. brace-expansion과 React Native CLI 계열 등 전이·도구 의존성이 포함되어 현재 앱 runtime 도달성을 입증하지 못했으므로 별도 개선 항목으로 유지한다.
- 실제 PostgreSQL·Redis·S3·Firebase·Gemini·OpenAI 연동 E2E는 실행하지 않았다.
- 에뮬레이터 확인 당시 백엔드가 실행 중이지 않아 로그인 이후 인증 사용자 흐름, AI 통화, 알림, 업로드는 동적 검증하지 못했다. 이번 오프라인 로그인 자동화는 IME Back이 modal을 닫고 아래 회원가입 버튼을 누르는 경로로 이탈해 유효한 네트워크 오류 판정으로 사용하지 않았다.

## 분류에서 제외하거나 보류한 항목

- foreground FCM 표시와 알림 탭 deep-link는 사용자 영향 가능성이 있다. 다만 [COMMON.md](../specs/COMMON.md#L88)는 Kotlin을 token 발급·갱신 전용으로 한정하고 [NOTIFICATIONS.md](../specs/domains/NOTIFICATIONS.md#L105)는 data payload를 `notificationId`·`type`으로 확정하므로, 현재 코드 결함으로 세지 않고 staging foreground/background/cold E2E와 제품 결정 대상으로 보류했다.
- 로그인 직후 token 등록 5xx·offline의 재시도와 POST_NOTIFICATIONS 영구 차단 안내도 개선이 필요하지만 AppState 재등록·설정 이동 계약이 명시되지 않아 이번 P2에서 제외했다. QA-010의 실제 token 경쟁 결함과는 분리했다.
- AI 통화 AudioFocus, SDK 36 edge-to-edge inset, 가로 화면+IME bottom sheet는 정적 위험만 있고 실제 잘림·통화 중단 재현과 제품 정책이 없어 coverage 후보로 남겼다.
- 관리자 위임과 대상 사용자 탈퇴 경쟁은 양쪽이 같은 멤버십 row를 잠그며, 위임 선행 시 탈퇴가 관리자 상태를 다시 읽고 거부하고 탈퇴 선행 시 위임이 비활성 상태를 읽어 거부함을 확인해 결함에서 제외했다.
- 22시 scheduler tick을 서버 중단으로 놓치면 이미 준비된 건별 리포트의 해당 일일 리포트를 자동 backfill할 경로가 없다. 다만 [REPORTS.md](../specs/domains/REPORTS.md#L121)가 서버 재시작 후 누락 복구 정책을 미결정으로 두므로 결함 집계에서 제외하고 21:59~22:01 재기동 운영 시험 대상으로 남겼다.
- lint 26개 경고 중 일부는 Android build report 아래 생성 파일을 스캔한 결과다. 오류 0이며 개별 출시 결함으로 승격하지 않았다.
- release build 중 실제 `.env.production` 부재 경고는 배포 검증 공백이다. CI/CD 주입 실패가 확인되기 전에는 별도 제품 코드 결함으로 분류하지 않았다.
- 정적 경쟁 조건은 PostgreSQL READ COMMITTED, Hibernate 기본 전체 UPDATE, 현재 잠금 순서, unique·bulk delete 경로로 검증했다. QA-016~024의 실제 동시 부하 PoC와 EXPLAIN ANALYZE는 후속 검증이 필요하다.

## 출시 전 최소 종료 조건

1. 보안 High인 SEC-001과 P1 13건을 수정하고 각 실패 경로의 회귀 테스트를 추가한다. QA-032는 `S15P11B104-214` MR이 `develop`에 실제 병합된 뒤 운영 profile 통합 테스트까지 확인한다. — 2026-08-02 병합(`8ba72e4`)과 코드 대조·단위 4건·통합 5건·전체 suite 통과를 확인했다(QA-032 후속 검증 기록 참조). staging E2E만 잔여.
2. QA-014의 기존 HOUR_BEFORE 삭제 기대 테스트를 공식 스펙에 맞게 수정하고, 발송 뒤 startAt 변경 재현 테스트를 추가한다.
3. DB 동시성 테스트로 QA-016~024를 실제 PostgreSQL에서 재현하고 탈퇴 불변식·409·직렬 결과를 검증한다.
4. 느린·역순 응답 UI 테스트로 QA-020~028의 중복 탭, 닫기, 재열기, 로드 실패와 데이터 보존을 검증한다.
5. 대량 일정·다수 피보호자·동일 timestamp 피드 데이터로 QA-011·015·029의 요청 수, 쿼리 수, 페이지 중복·누락, 메모리 상한을 측정한다.
6. 서버를 21:59~22:01에 중단·재기동하는 운영 시험으로 누락 일일 리포트의 현재 동작을 확인하고 backfill 정책을 확정한다.
7. Android hardware·gesture Back과 마이크 영구 거부 E2E로 QA-030~031을 검증하고, FCM foreground/background/cold 수신도 별도 통과시킨다.
8. 실제 운영과 동일한 secret 주입 환경에서 clean assembleRelease를 수행하고 서명 인증서 fingerprint, HTTPS API URL, cleartext 차단을 확인한다.
9. SEC-002~008과 QA-033에 목적별 입력 상한, 허용 host·object key·저장소 실제 MIME·크기 검증, 로그인 rate limit, `groupIds` 최대 개수·fan-out 예산, page·batch·재시도 상한을 적용하고 부하·우회 회귀 테스트를 통과한다.
10. PostgreSQL·Redis·S3·FCM·Gemini·OpenAI가 연결된 staging에서 로그인 복원, 업로드, 30분 초과 AI 통화, 네트워크 전환, 프로세스 재시작을 E2E로 통과한다.
