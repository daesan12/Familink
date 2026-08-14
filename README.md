<div align="center">

<img src="docs/readme-assets/banner.png" alt="familink — 가족의 일상을 대화로 잇다" width="720" />

# familink

**AI 안부전화와 가족 간 일상 공유로 정서적 돌봄을 지원하는 서비스**

SSAFY 15기 2학기 공통 프로젝트 · 대전 1반 B104

</div>

---

## 목차

1. [프로젝트 소개](#1-프로젝트-소개)
2. [팀원 구성](#2-팀원-구성)
3. [프로젝트 정보](#3-프로젝트-정보)
4. [프로젝트 결과물](#4-프로젝트-결과물)

---

## 1. 프로젝트 소개

### 프로젝트명

**familink** — Family + Link. 떨어져 사는 가족을 하나의 그룹으로 연결합니다.

### 소개

바쁜 일상 속에서 부모님께 매일 전화드리기는 쉽지 않습니다. familink는 **AI가 대신 안부전화를 걸고, 그 내용을 요약 리포트로 가족에게 전달**합니다. 여기에 가족 피드·공용 캘린더·카네이션 잔디 같은 가벼운 일상 공유 기능을 더해, 보호자와 피보호자(고령 가족)가 부담 없이 서로의 하루를 확인할 수 있게 합니다.

- **AI 안부전화** — 6종 페르소나 중 원하는 상대를 골라 발신하면, OpenAI Realtime API 기반 실시간 음성 대화가 진행되고 AI 발화가 실시간 자막으로 표시됩니다.
- **요약 리포트** — 통화가 끝나면 건별 리포트(요약·감정·전달 메시지)가 생성되고, 매일 밤 일일 리포트가 자동으로 만들어집니다.
- **가족 피드·보관함** — 사진·영상과 함께 일상을 올리고 댓글·반응을 남기며, 보관함에서 구성원·날짜별로 모아봅니다.
- **공용 캘린더** — 가족 일정과 기념일을 등록하고 참여자를 지정하면 일정 알림이 발송됩니다.
- **그룹 관리** — 초대 코드와 관리자 승인으로 가족 그룹을 꾸리고, 여러 그룹을 화면 내 토글로 오가며, 구성원에게 호칭(별칭)을 붙일 수 있습니다.
- **카네이션 잔디·주간 효자랭킹** — 하루 1건 이상 게시하면 잔디가 쌓이고, 주간 랭킹 1위에게 왕관이 씌워집니다.
- **알림** — 앱 내 알림 목록·읽음 처리, FCM 푸시, 유형별 수신 설정을 지원합니다.

### 디렉토리 구조

```text
S15P11B104/
├── backend/                  # Spring Boot 3.5 백엔드 (Java 21)
│   ├── src/main/java/com/ssafy/s15p11b104/
│   │   ├── domain/           # account, calendar, call, carnation, feed,
│   │   │                     # file, group, notification, report
│   │   └── global/           # ai, api, config, entity, exception, security
│   ├── src/main/resources/db/migration/   # Flyway 마이그레이션
│   └── compose.local.yml     # 로컬 PostgreSQL·Redis
├── frontend/                 # React Native 0.86 Android 앱 (TypeScript)
│   ├── src/
│   │   ├── features/         # ai-call, archive, auth, calendar, feed,
│   │   │                     # group-info, notifications, profile, reports
│   │   ├── app-shell/        # 그룹 전환 등 앱 셸 상태
│   │   ├── design/           # 디자인 토큰
│   │   ├── navigation/       # React Navigation 구성
│   │   └── shared/           # 공용 API 클라이언트·유틸
│   └── android/              # Kotlin 네이티브 (WebRTC AI 통화, FCM 모듈)
├── docs/                     # README 미디어, 코드 컨벤션
├── infrastructure/           # AWS 기반, Jenkins CI, staging/production 컴포즈
└── Jenkinsfile               # 테스트 → 빌드 → ECR → 배포 파이프라인
```

---

## 2. 팀원 구성

| 손수호 | 이종철 | 홍유라 | 강다영 | 이경호 | 장대산 |
|:---:|:---:|:---:|:---:|:---:|:---:|
| <img src="docs/readme-assets/members/shd437s.png" width="100" alt="손수호" /> | <img src="docs/readme-assets/members/whdcjf5454.png" width="100" alt="이종철" /> | <img src="docs/readme-assets/members/hongula2000.png" width="100" alt="홍유라" /> | <img src="docs/readme-assets/members/kdyarchive.png" width="100" alt="강다영" /> | <img src="docs/readme-assets/members/rudgh8182.png" width="100" alt="이경호" /> | <img src="docs/readme-assets/members/diqkraud.png" width="100" alt="장대산" /> |
| **AI** | **AI** | **Frontend** | **Frontend** | **Backend** | **Backend · Infra** |
| [@shd437s](https://lab.ssafy.com/shd437s) | [@whdcjf5454](https://lab.ssafy.com/whdcjf5454) | [@hongula2000](https://lab.ssafy.com/hongula2000) | [@kdyarchive](https://lab.ssafy.com/kdyarchive) | [@rudgh8182](https://lab.ssafy.com/rudgh8182) | [@diqkraud](https://lab.ssafy.com/diqkraud) |

---

## 3. 프로젝트 정보

### 사용 환경

| 구분 | 요구 사항 |
|---|---|
| 백엔드 | JDK 21, Docker(Compose), PostgreSQL 16 · Redis 7.4 (컴포즈로 자동 실행) |
| 프론트엔드 | Node.js ≥ 22.11.0, JDK 17, Android Studio + Android SDK |
| 지원 플랫폼 | Android 7.0(API 24) ~ Android 16(API 36) · 웹/iOS 미지원 |

모바일 앱 프로젝트로 브라우저는 지원하지 않습니다. (백엔드에 포함된 `/ai-call/` 웹 UI는 개발 검증 전용입니다.)

### 설치 및 실행 — 백엔드

```bash
cd backend
cp .env.example .env                                      # 환경변수 채우기 (아래 표 참고)
docker compose --env-file .env -f compose.local.yml up -d # PostgreSQL 16 + Redis 7.4
./gradlew bootRun                                         # Windows는 .\gradlew.bat bootRun
```

실행 확인: `http://localhost:8080/actuator/health` · Swagger `http://localhost:8080/swagger-ui.html`

주요 환경변수(`backend/.env.example`):

| 변수 | 용도 |
|---|---|
| `POSTGRES_*`, `REDIS_*` | 로컬 DB·캐시 접속 정보 |
| `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL` | AI 안부전화 실시간 음성 |
| `GMS_API_KEY` 또는 `GEMINI_*` | 리포트·게시글 분석용 Gemini 호출 |
| `GOOGLE_APPLICATION_CREDENTIALS`, `PUSH_ENABLED` | FCM 푸시 |
| `S3_*`, `AWS_*`, `MEDIA_*`, `FFPROBE_PATH` | 미디어 업로드·검증 |

### 설치 및 실행 — 프론트엔드(Android)

```bash
cd frontend
npm install                                    # postinstall에서 patch-package 적용
cp .env.development.example .env.development   # API_BASE_URL=http://10.0.2.2:8080 (에뮬레이터 기준)
npm run android:dev                            # Metro·기기 연결 검사 후 빌드 & 실행
```

`npm start`(Metro)와 `npm run android`를 따로 실행해도 됩니다. 릴리스 빌드는 `frontend/android/keystore.properties`에 서명 정보가 필요합니다.

### 테스트 및 정적 분석

```bash
# 백엔드 (Testcontainers 기반 — Docker 필요)
cd backend && ./gradlew test

# 프론트엔드
cd frontend && npm test
npm run typecheck && npm run lint
```

### 구현 목록

| 도메인 | 구현 내용 |
|---|---|
| 계정·프로필 | 로그인 ID/비밀번호 인증(JWT), 회원가입·온보딩, 프로필·관심사, 탈퇴 |
| 그룹 | 그룹 생성, 초대 코드 + 관리자 승인 가입, 다중 그룹 전환, 호칭, 관리자 위임 |
| 피드·미디어 | 140자 본문 + 사진 1~4장/영상 1개, 댓글·반응, 보관함 필터, 게시글 AI 분석 |
| AI 통화 | 6종 페르소나, WebRTC 실시간 음성, 실시간 자막, 당일 게시글 컨텍스트 주입, Tool Calling(인물별 소식·일정 조회) |
| 리포트 | 통화 건별 리포트(요약·감정·전달 메시지), 일일 리포트 자동 생성 |
| 캘린더 | 일정 CRUD, 참여자 지정, 일정 알림, AI 일정 조회 연동 |
| 알림 | 앱 내 알림 목록·읽음 처리, FCM 푸시, 유형별 수신 설정 |
| 카네이션·랭킹 | 게시 기반 잔디 적립, 주간 효자랭킹, 지난주 1위 왕관 |

### 간단한 사용 방법

1. 회원가입 후 가족 그룹을 만들고 **초대 코드**를 가족에게 공유합니다. 가입 요청은 그룹 관리자가 승인합니다.
2. 피보호자(부모님) 기기에서 **AI 전화 탭 → 페르소나 선택 → 발신**하면 AI와 음성 대화가 시작됩니다.
3. 통화가 끝나면 **리포트 탭**에서 건별 리포트를, 매일 밤에는 일일 리포트를 확인할 수 있습니다.
4. **피드**에 사진·영상으로 일상을 올리면 카네이션 잔디가 쌓이고, 주간 효자랭킹이 집계됩니다.

---

## 4. 프로젝트 결과물

### AI 안부전화

"듬직한 아들", "친구 복희"처럼 관계와 성격이 다른 **6종 페르소나** 중에서 오늘 이야기할 상대를 고릅니다. 페르소나를 선택하면 다정한 말투, 정겨운 사투리 같은 대화 스타일 설명이 함께 표시되어 어떤 대화가 될지 미리 알 수 있습니다.

발신하면 **실시간 음성 대화**가 시작됩니다. 정해진 질문을 읽어주는 방식이 아니라 대답을 듣고 자연스럽게 이어가는 양방향 대화이며, 예약 발신이 아니라 **어르신이 원할 때 직접 거는 구조**입니다. AI가 말하는 내용은 **실시간 자막**으로 표시되어, 소리가 잘 들리지 않아도 대화를 눈으로 따라갈 수 있습니다.

AI는 **그날 가족이 피드에 올린 소식을 알고 통화를 시작합니다.** 아들이 미역국 사진을 올렸다면 "별일 없으셨어요?" 대신 **"아드님이 미역국 끓이셨다면서요"** 처럼 오늘 실제로 있었던 일에서 대화가 출발합니다.

대화 중 궁금한 것은 AI가 그 자리에서 찾아봅니다(**Tool Calling**). "우리 딸 요즘 뭐 하고 지내?"라고 물으면 그 사람의 최근 소식을, "이번 주에 무슨 일정 있나?"라고 물으면 공용 캘린더의 일정을 확인해 답합니다. 앱을 직접 열어보기 어려운 어르신도 말로 물어보는 것만으로 가족 소식을 확인할 수 있습니다.

| 페르소나 선택 | 통화 (실시간 자막) |
|:---:|:---:|
| <img src="docs/readme-assets/1-ai-call/capture-call-persona-select.png" width="240" /> | <img src="docs/readme-assets/1-ai-call/ai-call.gif" width="240" /> |

### 요약 리포트

통화가 끝나면 그 통화만의 **건별 리포트**가 만들어집니다. 무슨 이야기를 나눴는지 100자 이내로 요약하고, 대화에서 읽어낸 **감정**과 어르신이 가족에게 전하고 싶어 한 **전달 메시지**를 함께 담습니다. 리포트 목록은 통화 시각별로 정리되어 원하는 통화를 골라 볼 수 있습니다.

하루가 끝나는 **매일 22시에는 그날의 통화를 묶은 일일 리포트**가 자동으로 생성됩니다. 200자 이내로 하루의 흐름을 정리하기 때문에, 보호자는 통화 내용을 일일이 확인하지 않아도 부모님이 어떤 하루를 보냈는지 한눈에 파악할 수 있습니다.

| 일일 리포트 | 통화 리포트 목록 |
|:---:|:---:|
| <img src="docs/readme-assets/2-report/daily-report.jpg" width="240" /> | <img src="docs/readme-assets/2-report/call-report-list.jpg" width="240" /> |

### 가족 피드

**140자 본문에 사진 1~4장 또는 영상 1개**를 붙여 그날의 일상을 올립니다. 글자 수를 제한한 이유는 길게 쓰는 부담을 없애기 위해서로, "오늘 뭐 했어요" 한 줄과 사진 한 장이면 충분합니다. 올라온 글에는 **댓글과 반응**으로 서로 응답할 수 있습니다.

피드는 그룹 단위로 분리되어 있어, 여러 가족 그룹에 속해 있어도 지금 보고 있는 그룹의 소식만 표시됩니다.

여기에 올라온 글은 **[AI 안부전화](#ai-안부전화)의 대화 소재로도 쓰입니다.**

| 피드 | 게시글 상세·댓글 |
|:---:|:---:|
| <img src="docs/readme-assets/3-feed/clip-feed-scroll.gif" width="240" /> | <img src="docs/readme-assets/3-feed/capture-feed-detail-comment.png" width="240" /> |

### 보관함

피드에 올라온 사진과 영상만 따로 모아 날짜순으로 보여줍니다. 시간이 지나 피드 아래로 밀려난 사진도 여기서는 쉽게 찾을 수 있습니다.

**구성원·날짜·미디어 유형** 세 가지로 필터링할 수 있어, "엄마가 올린 사진만", "지난달 것만" 같은 방식으로 좁혀볼 수 있습니다.

| 미디어 모아보기 | 구성원 필터 |
|:---:|:---:|
| <img src="docs/readme-assets/4-archive/capture-archive-grid.png" width="240" /> | <img src="docs/readme-assets/4-archive/capture-archive-filter.png" width="240" /> |

### 공용 캘린더

생일, 가족 모임, 영상통화 약속 같은 **그룹 일정과 기념일**을 함께 관리합니다. 일정에는 제목과 시간 외에 세부 내용을 적을 수 있고, **참여자를 지정**하면 그 구성원들에게 일정 알림이 발송됩니다.

월간 달력에서 일정이 있는 날을 바로 확인하고, 날짜를 누르면 그날 등록된 일정 목록이 아래에 펼쳐집니다.

| 월간 뷰 | 날짜별 일정 | 일정 상세 |
|:---:|:---:|:---:|
| <img src="docs/readme-assets/5-calendar/capture-calendar-month.png" width="220" /> | <img src="docs/readme-assets/5-calendar/capture-calendar-selected.png" width="220" /> | <img src="docs/readme-assets/5-calendar/capture-schedule-detail.png" width="220" /> |

### 그룹 관리

그룹을 만들면 **초대 코드**가 발급됩니다. 가족에게 코드를 전달해 가입을 요청받고, **그룹 관리자가 승인**해야 구성원이 되는 2단계 구조라 모르는 사람이 들어올 수 없습니다. 구성원은 **보호자와 피보호자**로 구분되며, 각자에게 "사랑하는 엄마" 같은 **호칭(별칭)** 을 붙일 수 있습니다.

한 사람이 **여러 그룹에 동시에 속할 수 있고**, 화면 상단의 그룹 이름을 눌러 바로 전환합니다. 시댁과 친정처럼 둘 이상의 가족을 앱 하나로 관리할 수 있습니다. 이 밖에 관리자 위임, 구성원 내보내기, 그룹명 변경, 그룹 나가기·삭제를 지원합니다.

| 그룹 정보·구성원 | 그룹 전환 |
|:---:|:---:|
| <img src="docs/readme-assets/6-group/capture-group-info.png" width="240" /> | <img src="docs/readme-assets/6-group/capture-group-switch-sheet.jpg" width="240" /> |

### 카네이션 잔디 · 주간 효자랭킹

**하루에 게시글을 1건 이상 올리면 카네이션 도장이 하루 1개** 찍힙니다. 여러 개를 올려도 하루 1개까지만 쌓이기 때문에, 몰아서 올리기보다 꾸준히 참여하도록 유도합니다.

일주일 단위로 도장 수를 집계해 **주간 효자랭킹**을 만들고, **지난주 1위에게는 프로필에 왕관**이 표시됩니다. 안부를 전하는 일을 의무가 아니라 가벼운 놀이처럼 만들기 위한 장치입니다. 월별 달력에서 자신이 어느 날 참여했는지도 되돌아볼 수 있습니다.

| 도장 현황 | 도장 달력 | 주간 랭킹 |
|:---:|:---:|:---:|
| <img src="docs/readme-assets/7-stamp-ranking/capture-mypage-stamp.png" width="220" /> | <img src="docs/readme-assets/7-stamp-ranking/capture-stamp-calendar.png" width="220" /> | <img src="docs/readme-assets/7-stamp-ranking/weekly-ranking.jpg" width="220" /> |

### 알림

일정 시작, 통화 리포트 생성, 게시글 반응처럼 놓치면 아쉬운 소식을 **FCM 푸시**로 알립니다. 앱을 열면 알림 목록에서 지난 알림을 모아 볼 수 있고, 확인한 알림은 **읽음 처리**되어 새 소식만 눈에 띄게 남습니다.

알림이 많아 부담스러우면 **유형별로 수신을 끌 수 있습니다.** 예를 들어 리포트 알림만 받고 반응 알림은 끄는 식입니다.

| 알림 목록 | 알림 설정 |
|:---:|:---:|
| <img src="docs/readme-assets/8-notification/capture-notification-list.png" width="240" /> | <img src="docs/readme-assets/8-notification/notification-settings.jpg" width="240" /> |

> 위 화면의 인물 사진과 게시글은 시연용으로 생성한 데모 데이터입니다.
