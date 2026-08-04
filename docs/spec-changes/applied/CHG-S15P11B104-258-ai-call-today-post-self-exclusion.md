# AI 통화 시작 프롬프트의 당일 게시글에서 피보호자 본인 게시글 제외

- 상태: 반영 완료
- 제안자: rudgh8182
- 작성일: 2026-08-04
- 차단 변경: 아니오
- 영향 스펙·계약: [AI_CALL](../../specs/domains/AI_CALL.md) 확정된 동작 8, [COVERAGE](../../specs/COVERAGE.md) REQ-045
- 관련 작업: S15P11B104-258

## 기존 내용

`docs/specs/domains/AI_CALL.md` 「확정된 동작」 8번은 주입 대상을 작성자
기준으로 제한하지 않는다.

> Spring Boot는 현재 그룹의 저장된 관심사, 가족 구성원 맥락과 당일 게시글
> 분석 결과를 통화 시작 프롬프트에 주입한다.

`docs/specs/COVERAGE.md` REQ-045 행도 "AI 통화 시작 시 당일 게시글 맥락
주입"을 같은 범위로 기록하고, 조회 건수 상한을 명시하지 않는다.

## 제안 내용

「확정된 동작」 8번의 당일 게시글 주입 범위를 다음 규칙으로 좁힌다.

1. 현재 피보호자 본인이 작성한 당일 게시글의 분석 결과는 통화 시작
   프롬프트에 주입하지 않는다.
2. 같은 현재 그룹의 다른 가족 구성원이 작성한 당일 게시글 분석 결과는
   기존과 같이 주입한다.
3. 본인 게시글을 제외한 뒤 남은 당일 게시글 중 최신 최대 10건을 주입한다.
   제외 전 10건을 먼저 선택하지 않는다.

3번은 본인 게시글이 상한을 소진해 가족 게시글이 밀려나는 결과를 배제하기
위한 검증 가능한 기준이다.

## 변경 근거

- 사용자 결정: 피보호자 본인이 쓴 게시물이 본인에게 다시 대화 소재로
  제시되는 동작을 결함으로 판단하고, 본인 게시물 제외·가족 게시물 유지·제외
  후 최대 10건 규칙의 공식 스펙 반영을 승인했다(S15P11B104-258 설명,
  2026-08-04).
- 구현 근거: `backend/src/main/java/com/ssafy/s15p11b104/domain/call/repository/PostAnalysisCallRepository.java`의
  당일 게시글 조회는 그룹·분석 상태·KST 날짜 경계만 필터링했고,
  `backend/src/main/java/com/ssafy/s15p11b104/domain/call/service/AiCallPromptContextProvider.java`가
  `PageRequest.of(0, 10)`으로 상한을 적용했다. 두 조건 모두 작성자를 구분하지
  않아 기존 스펙 문구만으로는 본인 게시글이 주입되는 동작이 규칙 위반으로
  판정되지 않았다.
- 검증 근거: `AiCallPromptContextProviderIntegrationTest`의
  `excludesCareReceiverOwnPostsBeforeApplyingPostLimit`이 본인 게시글 10건과
  더 오래된 가족 게시글 1건 조건에서 가족 게시글만 남는 결과를 확인했다.

## 확인된 영향

- 영향 도메인: AI 통화. 당일 게시글 원본을 생산하는 피드 도메인의 저장·조회
  동작은 바뀌지 않는다.
- 영향 계약: 없음. 공개 API 응답, DB 스키마, 인증·권한 계약은 바뀌지 않는다.
  통화 중 Tool `get_person_recent_post_summaries`의 계약도 그대로다.
- 영향 화면: 없음. 프롬프트 주입은 서버 내부 처리이며 클라이언트 화면
  구성에 노출되지 않는다.
- 검증 범위: `AiCallPromptContextProviderIntegrationTest` 5건,
  `AiCallPromptContextProviderTest`, `BackendApplicationTests`를 실행해
  통과했다. 운영 환경 통화 확인은 배포 후에만 가능하므로 `확인 필요`다.
- 탈퇴 후 같은 날 재가입해 `group_members` 행이 새로 생긴 피보호자의 이전
  멤버십 게시글 처리는 `확인 필요`다. 이 쿼리는 기존에도 `author.leftAt`을
  필터하지 않으며 탈퇴 구성원 정책은 이 제안의 범위가 아니다.

## 결정 및 반영

- 결정: 승인. 제안 내용 1~3번 전체를 반영했다.
- 결정자: rudgh8182
- 결정일: 2026-08-04
- 반영 문서: [AI_CALL](../../specs/domains/AI_CALL.md) 확정된 동작 8,
  [COVERAGE](../../specs/COVERAGE.md) REQ-045
- 반영 커밋:
