# Frontend

Android용 React Native 애플리케이션입니다. Node.js 22.11.0 이상, JDK 17,
Android Studio와 Android SDK가 필요합니다.

## 최초 설치

`frontend` 디렉터리에서 의존성을 설치합니다.

```bash
npm install
```

## Android 에뮬레이터에서 실행

Android Studio의 Device Manager에서 에뮬레이터를 먼저 실행합니다. 터미널
하나에서 Metro 개발 서버를 실행합니다.

로컬 API 주소를 준비합니다.

```powershell
Copy-Item .env.development.example .env.development
```

기본 주소 `http://10.0.2.2:8080`에서 `10.0.2.2`는 Android 에뮬레이터가
개발 PC에 접근할 때 사용하는 특수 주소입니다. 백엔드는 PC의
`http://localhost:8080/actuator/health`에서 먼저 응답해야 합니다. 백엔드를
컨테이너로 실행한다면 컨테이너의 8080 포트를 호스트의 8080 포트에
게시해야 합니다.

```bash
npm start
```

다른 터미널에서 앱을 빌드하고 에뮬레이터에 설치합니다.

```bash
npm run android
```

`S15P11B104`와 실행 환경 준비 안내가 표시되면 정상입니다.

`.env.development` 값을 바꾸면 Metro만 다시 시작하지 말고 Android 앱을
다시 빌드합니다. 실제 Android 기기는 `10.0.2.2`를 사용할 수 없습니다.
USB 연결에서는 `adb reverse tcp:8080 tcp:8080`을 설정하고
`http://localhost:8080`을 사용하거나, 같은 네트워크에 있는 개발 PC의
LAN IP를 사용합니다.

## API 환경 설정

개발 빌드는 `.env.development`, 배포 빌드는 `.env.production`을 사용합니다.
실제 환경 파일은 Git에 커밋하지 않으며, 저장소의 example 파일을 복사하거나
CI/CD에서 생성합니다.

```dotenv
API_BASE_URL=https://api.example.com
```

API 주소에는 `/api/v1` 같은 별도 기본 경로를 붙이지 않습니다. 배포 빌드의
주소는 HTTPS여야 합니다. 모바일 앱의 환경값은 빌드 결과에서 확인할 수
있으므로 JWT secret, DB 비밀번호, 외부 API 키 같은 비밀값을 넣지 않습니다.

## 검증

```bash
npm run check:structure
npm run typecheck
npm run lint
npm test
```
