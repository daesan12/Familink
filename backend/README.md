# Backend

Java 21과 Spring Boot 3.5.16 기반의 S15P11B104 백엔드입니다.

## 요구 환경

- JDK 21
- Docker Desktop 또는 Docker Engine과 Docker Compose

Gradle은 별도로 설치하지 않습니다. 저장소의 Gradle Wrapper를 사용합니다.

## 로컬 실행

`backend` 디렉터리에서 로컬 환경 파일을 준비합니다.

```powershell
Copy-Item .env.example .env
```

PostgreSQL 16과 Redis를 실행합니다.

```powershell
docker compose --env-file .env -f compose.local.yml up -d
```

애플리케이션을 실행합니다. 기본 로컬 설정값은 `.env.example`과 동일하므로
별도 환경변수 없이 실행할 수 있습니다.

```powershell
.\gradlew.bat bootRun
```

확인 주소:

- Health: `http://localhost:8080/actuator/health`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`

## 환경변수

| 이름 | 기본값 | 용도 |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/s15p11b104` | PostgreSQL JDBC URL |
| `POSTGRES_DB` | `s15p11b104` | 로컬 DB 이름 |
| `POSTGRES_USER` | `s15p11b104` | 로컬 DB 사용자 |
| `POSTGRES_PASSWORD` | `local_postgres_password` | 로컬 DB 비밀번호 |
| `POSTGRES_PORT` | `5432` | 로컬 PostgreSQL 포트 |
| `REDIS_HOST` | `localhost` | Redis 호스트 |
| `REDIS_PASSWORD` | `local_redis_password` | 로컬 Redis 비밀번호 |
| `REDIS_PORT` | `6379` | 로컬 Redis 포트 |

기본값은 로컬 개발 전용입니다. 운영 환경에서는 모든 비밀값을 환경변수 또는
비밀 관리 시스템으로 주입합니다.

## 테스트

```powershell
.\gradlew.bat clean test
```

Docker가 실행 중이면 Testcontainers가 PostgreSQL과 Redis를 띄워 Spring
Context, Flyway, JPA와 Redis 연결을 함께 검증합니다. Docker를 사용할 수 없는
환경에서는 해당 통합 테스트를 건너뛰고 Docker 비의존 테스트만 실행합니다.

## 데이터베이스 변경

DB 스키마는 Flyway가 소유합니다. Hibernate 자동 생성은 사용하지 않고
`ddl-auto=validate`로 Flyway 스키마와 Entity의 일치 여부만 검증합니다.

마이그레이션 파일은 다음 경로에 추가합니다.

```text
src/main/resources/db/migration/
```

실제 인증 API, 도메인 비즈니스 로직, AWS·Firebase·AI 연동과 운영 배포
인프라는 후속 Jira 티켓에서 구현합니다.
