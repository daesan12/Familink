# AI 전화 로컬 실행 및 테스트 가이드

이 문서는 Jira `S15P11B104-137`에서 구현한 1단계 AI 전화 기능을 로컬에서
실행하고 실제 OpenAI Realtime 음성 통화를 확인하는 절차를 설명한다.

현재 AI 전화 화면은 정식 Kotlin·React Native 화면이 아니라 Spring Boot가
정적 파일로 제공하는 임시 Web UI다. 따라서 실제 통화 테스트를 위해
`frontend` 프로젝트를 별도로 실행할 필요는 없다.

## 1. 실행 구성

로컬 테스트에는 다음 구성 요소가 사용된다.

| 구성 요소 | 실행 방법 | 기본 주소·포트 |
| --- | --- | --- |
| 임시 Web UI | Spring Boot 정적 리소스 | `http://localhost:8080/ai-call/` |
| Backend API | Spring Boot `local,ai-call-dev` 프로필 | `http://localhost:8080` |
| PostgreSQL 16 | Docker Compose | `localhost:5432` |
| Redis 7.4 | Docker Compose | `localhost:6379` |
| OpenAI Realtime | Backend에서 외부 API 연결 | `gpt-realtime-2` |

Redis는 현재 AI 통화 1단계에서 직접 사용하지 않지만, 프로젝트의 로컬 실행
구성과 Spring Context 검증을 맞추기 위해 PostgreSQL과 함께 실행한다.

## 2. 사전 준비

다음 항목이 설치·설정되어 있어야 한다.

- JDK 21
- Docker Desktop
- 마이크를 사용할 수 있는 Chrome 또는 Edge
- OpenAI API 키
- OpenAI 프로젝트의 API 사용 가능 상태와 결제 한도

PowerShell에서 설치 상태를 확인한다.

```powershell
java -version
javac -version
docker --version
docker compose version
```

`java`와 `javac`는 모두 JDK 21을 가리켜야 한다. Docker 명령이 인식되지
않으면 Docker Desktop을 실행한 뒤 새 PowerShell을 열어 다시 확인한다.

## 3. 환경 파일 준비

저장소 루트에서 `backend` 디렉터리로 이동한다.

```powershell
cd C:\Users\SSAFY\S15P11B104\backend
```

`.env`가 없다면 예제 파일을 복사한다.

```powershell
Copy-Item .env.example .env
```

`backend/.env`의 `OPENAI_API_KEY`에 실제 키를 입력한다.

```dotenv
POSTGRES_DB=s15p11b104
POSTGRES_USER=s15p11b104
POSTGRES_PASSWORD=local_postgres_password
POSTGRES_PORT=5432

REDIS_PASSWORD=local_redis_password
REDIS_PORT=6379

OPENAI_API_KEY=실제_API_키
OPENAI_REALTIME_MODEL=gpt-realtime-2
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE=ko
```

주의 사항:

- API 키를 Web UI, JavaScript, Git 커밋에 입력하지 않는다.
- API 키는 Backend만 읽고 OpenAI 요청에 사용한다.
- `.env`가 Git에서 제외되는지 다음 명령으로 확인할 수 있다.

```powershell
git check-ignore .env
```

## 4. PostgreSQL과 Redis 실행

`backend` 디렉터리에서 Docker Compose를 실행한다.

```powershell
docker compose --env-file .env -f compose.local.yml up -d
```

컨테이너 상태를 확인한다.

```powershell
docker compose --env-file .env -f compose.local.yml ps
```

`postgres`와 `redis`가 모두 `healthy` 상태가 될 때까지 기다린다.

필요한 경우 로그를 확인한다.

```powershell
docker compose --env-file .env -f compose.local.yml logs postgres
docker compose --env-file .env -f compose.local.yml logs redis
```

## 5. Backend와 임시 Web UI 실행

`ai-call-dev` 프로필을 포함해 Spring Boot를 실행한다.

```powershell
.\gradlew.bat bootRun --args='--spring.profiles.active=local,ai-call-dev'
```

이 명령 하나가 다음 항목을 함께 실행한다.

- AI 전화 REST API
- OpenAI Realtime 연동 코드
- Sideband WebSocket 관리자
- 임시 Web UI
- 로컬 AI 전화 테스트용 DB fixture

별도의 `npm`, React 또는 React Native 개발 서버는 실행하지 않는다.

서버가 기동되면 다른 PowerShell에서 상태를 확인한다.

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080/actuator/health
Invoke-WebRequest -UseBasicParsing http://localhost:8080/ai-call/
```

두 요청 모두 HTTP `200`이어야 한다.

## 6. 개발용 DB fixture

`ai-call-dev` 프로필은 로컬 DB에 다음 테스트 데이터를 중복 없이 준비한다.

- 피보호자: `김수호` (`ai-call-user`)
- 가족 그룹: `AI가족` (`AICALL`)
- 보호자 가족 구성원 2명과 피보호자 기준 표시명
- 피보호자 관심사
- KST 당일 가족 게시글과 `SUCCESS` 분석 요약
- 최근 완료 통화와 통화 요약 1건

기존 fixture 게시글은 백엔드를 시작할 때마다 `created_at`과 `updated_at`을
현재 시각으로 갱신하므로, Docker 볼륨을 유지해도 KST 당일 게시글로 조회된다.

fixture는 프롬프트의 다음 네 블록을 실제 DB 데이터로 확인하기 위해 사용한다.

1. 피보호자 정보
2. 가족 구성원 표시명
3. 당일 가족 게시글 분석
4. 최근 통화 요약

DB 접속과 통화 상태 확인 예시는 다음과 같다.

```powershell
docker compose --env-file .env -f compose.local.yml exec postgres `
  psql -U s15p11b104 -d s15p11b104
```

`psql` 안에서 최근 통화 세션을 확인한다.

```sql
SELECT id, persona_id, status, created_at, started_at, ended_at
FROM call_sessions
ORDER BY id DESC
LIMIT 10;
```

종료하려면 `\q`를 입력한다.

## 7. 실제 AI 전화 테스트

Chrome 또는 Edge에서 다음 주소를 연다.

```text
http://localhost:8080/ai-call/
```

테스트 순서:

1. 여섯 페르소나 중 하나를 선택한다.
2. `전화걸기` 버튼을 누른다.
3. 브라우저의 마이크 권한 요청을 허용한다.
4. `연결 준비 중 → 연결 중 → 통화 중` 상태 변화를 확인한다.
5. 한국어로 짧게 인사하고 AI 음성이 스피커로 재생되는지 확인한다.
6. AI 발화가 화면 자막으로 표시되는지 확인한다.
7. 마이크 끄기·켜기와 스피커 끄기·켜기를 확인한다.
8. 종료 버튼을 누르고 통화 시간이 표시되는지 확인한다.
9. DB의 최신 `call_sessions.status`가 `COMPLETED`인지 확인한다.

각 페르소나별로 한 번씩 반복한다.

| ID | 페르소나 | OpenAI 음성 |
| ---: | --- | --- |
| 1 | 사랑스러운 아들 | `ash` |
| 2 | 사랑스러운 딸 | `sage` |
| 3 | 남자 비서 | `cedar` |
| 4 | 여자 비서 | `marin` |
| 5 | 친구 학수 | `verse` |
| 6 | 친구 복희 | `ballad` |

통화 화면 아래의 `개발 로그`를 펼치면 다음 흐름을 확인할 수 있다.

```text
마이크 스트림 준비
SDP offer 생성
통화 세션 생성
SDP answer 적용
WebRTC 연결 완료
Realtime 이벤트 수신
통화 종료 및 브라우저 자원 정리
```

실제 통화는 OpenAI API 사용량과 비용을 발생시킬 수 있다.

## 8. 정상 동작 기준

- 페르소나 선택에 맞는 음성이 재생된다.
- 사용자 마이크 음성이 OpenAI에 전달되고 AI 음성이 재생된다.
- AI 발화 자막이 실시간으로 표시된다.
- 한 번에 활성 통화가 하나만 생성된다.
- 연결 전 종료는 `CANCELLED`, 연결 실패는 `FAILED`가 된다.
- 정상 연결 후 사용자 종료는 `COMPLETED`가 된다.
- 비정상 Sideband 종료는 연결 상태에 따라 `FAILED` 또는 `INCOMPLETE`가 된다.
- 종료 후 마이크 트랙, WebRTC 연결과 Sideband 연결이 정리된다.
- 브라우저나 응답에 OpenAI API 키가 노출되지 않는다.

1단계에서는 사용자·AI 전사를 `call_transcripts`에 저장하지 않는다. 화면에는
AI 자막만 표시한다.

## 9. 종료

Spring Boot를 실행한 터미널에서 `Ctrl+C`를 누른다.

Docker 컨테이너만 중지하고 데이터 볼륨은 유지하려면 다음 명령을 사용한다.

```powershell
docker compose --env-file .env -f compose.local.yml stop
```

컨테이너를 제거하되 DB·Redis 볼륨은 유지하려면 다음 명령을 사용한다.

```powershell
docker compose --env-file .env -f compose.local.yml down
```

`down -v`는 로컬 PostgreSQL과 Redis 데이터를 삭제하므로 테스트 데이터를
완전히 초기화할 때만 사용한다.

## 10. 문제 해결

### 8080 포트가 이미 사용 중인 경우

먼저 기존 Backend가 정상 실행 중인지 확인한다.

```powershell
Test-NetConnection 127.0.0.1 -Port 8080
Invoke-WebRequest -UseBasicParsing http://localhost:8080/actuator/health
```

헬스 체크가 성공하면 새 서버를 중복 실행하지 않고 기존 서버를 사용한다.
실패하면 Backend를 실행했던 IntelliJ 또는 PowerShell 프로세스를 먼저
종료한 뒤 다시 실행한다.

### Docker 연결 오류

```powershell
docker info
docker compose --env-file .env -f compose.local.yml ps
```

Docker Desktop이 완전히 실행됐는지 확인한다. 환경 변수 PATH를 변경한
직후라면 PowerShell, IntelliJ와 Codex를 새로 시작한다.

### `502 AI_CONNECTION_FAILED`

다음을 확인한다.

- `backend/.env`의 `OPENAI_API_KEY`
- OpenAI 프로젝트의 API 사용 가능 상태와 결제 한도
- `OPENAI_REALTIME_MODEL=gpt-realtime-2`
- `OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-transcribe`
- `OPENAI_REALTIME_TRANSCRIPTION_LANGUAGE=ko`
- 방화벽·프록시의 `api.openai.com`, `wss://api.openai.com` 접근
- Backend 로그의 OpenAI 또는 Sideband 연결 오류

### 마이크가 동작하지 않는 경우

- 브라우저 주소창의 사이트 권한에서 마이크를 허용한다.
- Windows 개인정보 설정에서 브라우저의 마이크 접근을 허용한다.
- 다른 프로그램이 마이크를 독점하고 있지 않은지 확인한다.
- `localhost` 주소를 사용한다. 원격 HTTP 주소에서는 브라우저가 마이크
  접근을 제한할 수 있다.

### `409 ACTIVE_CALL_EXISTS`

이미 `CONNECTING` 또는 `IN_PROGRESS` 상태인 통화가 존재한다는 의미다.
열려 있는 다른 통화 화면을 먼저 종료하고 DB의 최신 `call_sessions`
상태를 확인한다. 로컬 테스트 DB 전체를 초기화해도 되는 경우에만
Docker 볼륨을 제거하고 fixture를 다시 생성한다.

## 11. 관련 문서

- [AI_CALL_PLAN.md](./AI_CALL_PLAN.md)
- [Backend README](./backend/README.md)
- [AI 전화 공식 로컬 스펙](./docs/specs/domains/AI_CALL.md)
- [API 계약](./docs/specs/contracts/API.md)
