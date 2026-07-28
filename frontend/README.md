# Frontend

React Native 제품 모듈을 위한 초기 폴더 구조입니다.

현재 작업 범위는 공통 진입점과 `feed` 기능 디렉터리의 구조를 확정하고,
구조가 누락되지 않았는지 로컬에서 검증할 수 있게 만드는 것까지입니다.
React Native 의존성, Android 네이티브 프로젝트, 실행·빌드 설정과 실제 피드
기능은 아직 구성하지 않았습니다.

## 구조 검증

Node.js 22.11.0 이상에서 다음 명령을 실행합니다.

```bash
npm run check:structure
```

이 검사는 필수 디렉터리와 파일의 존재 여부, `package.json`과
`tsconfig.json`의 JSON 구문을 확인합니다.
