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

```bash
npm start
```

다른 터미널에서 앱을 빌드하고 에뮬레이터에 설치합니다.

```bash
npm run android
```

`S15P11B104`와 실행 환경 준비 안내가 표시되면 정상입니다.

## 검증

```bash
npm run check:structure
npm run typecheck
npm run lint
npm test
```
