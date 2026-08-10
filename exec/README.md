# 패밀링크(Familink) 포팅 매뉴얼

이 디렉터리는 패밀링크 Android 앱과 Spring Boot 백엔드를 처음 전달받은 사람이
프로젝트를 빌드·배포하고, 데이터베이스를 복원하며, 최종 시연을 재현하는 데 필요한
문서를 모은다.

## 문서 구성

| 파일 | 내용 |
|---|---|
| [`01_빌드_및_배포.md`](./01_빌드_및_배포.md) | 기술 버전, 환경변수, 로컬 빌드, Android APK 생성, 운영 배포 및 점검 |
| [`02_외부_서비스.md`](./02_외부_서비스.md) | AWS, Firebase, OpenAI, Gemini/GMS, Jenkins 등 외부 서비스 설정 |
| `03_DB_덤프.sql` | PostgreSQL 16 최신 스키마와 선택된 시연 데이터 덤프 |
| [`04_시연_시나리오.md`](./04_시연_시나리오.md) | 약 4분 분량의 보호자 민수·피보호자 영희 시연 순서와 장애 대응 |

## 서비스 구성 요약

```text
Android 앱
  └─ HTTPS https://api.familink360.com
       └─ Route 53 → EC2 Elastic IP → Nginx 443
            └─ Spring Boot 8080
                 ├─ RDS PostgreSQL 16
                 ├─ Redis 7.4
                 ├─ 비공개 S3 미디어 버킷
                 ├─ Firebase Cloud Messaging
                 ├─ OpenAI Realtime
                 └─ Gemini API / SSAFY GMS
```

## 처음 확인할 순서

1. 저장소의 `main` 브랜치를 가져온다.
2. [`01_빌드_및_배포.md`](./01_빌드_및_배포.md)의 필수 버전과 환경변수를 확인한다.
3. `03_DB_덤프.sql`을 비어 있는 PostgreSQL 16 데이터베이스에 복원한다.
4. 백엔드 health check가 `UP`인지 확인한다.
5. Android 앱을 빌드하고 API 주소가 운영 HTTPS 주소인지 확인한다.
6. [`04_시연_시나리오.md`](./04_시연_시나리오.md)의 사전 점검표를 수행한다.

## 보안 주의사항

- 실제 API 키, DB 비밀번호, JWT Secret, AWS Access Key, Firebase 서비스 계정 JSON,
  Android release keystore는 Git에 저장하지 않는다.
- 운영 비밀값은 AWS Parameter Store, Jenkins Credentials 또는 운영 서버의 Git 제외
  `.env`에서 관리한다.
- Android 앱의 `API_BASE_URL`은 빌드 결과에 포함되므로 비밀값으로 사용하지 않는다.
- 이 문서의 예시 비밀번호와 Placeholder는 운영 비밀번호로 사용하지 않는다.

## 기준 파일

- 백엔드 환경 예시: `backend/.env.example`
- 운영 환경 예시: `infrastructure/production/.env.example`
- Android 개발 환경 예시: `frontend/.env.development.example`
- Android 운영 환경 예시: `frontend/.env.production.example`
- Android release 서명 예시: `frontend/android/keystore.properties.example`
- DB 스키마 마이그레이션: `backend/src/main/resources/db/migration/`
- 데이터 모델 문서: `docs/specs/contracts/DATA_MODEL.md`

## DB 덤프 범위

`03_DB_덤프.sql`은 운영 DB를 그대로 복제하지 않고 시연 재현에 필요한 범위만
선택한 덤프다.

- 포함: Flyway 최신 스키마, 회원 4명, 가족 그룹 2개, 멤버십·호칭·관심사,
  게시글·미디어·댓글·반응·게시글 분석, 일정·참여자
- 제외: 통화 세션·전사, 건별/일일 리포트, 리포트 생성 작업, 알림·기기 토큰,
  카네이션, 로그인 세션과 Redis 데이터
- 원문 비밀번호·API Key는 포함하지 않으며 사용자 비밀번호는 BCrypt 해시만 포함한다.
