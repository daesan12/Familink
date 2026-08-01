# React Native 코드 컨벤션

> 기준: React Native TypeScript 문서와 React Hooks 규칙, 2026-07-28 확인
> 적용 범위: React Native 제품 모듈의 모든 `*.ts`, `*.tsx` 파일

React Native에는 단일한 공식 코딩 컨벤션이 없으므로 이 문서를 프로젝트의
구현 기준으로 사용한다. 공통 운영 방식은 [`README.md`](./README.md)를
따른다.

## 기준 자료

- [React Native와 TypeScript](https://reactnative.dev/docs/typescript)
- [React의 Hooks 규칙](https://react.dev/reference/rules/rules-of-hooks)
- [React Native 접근성](https://reactnative.dev/docs/accessibility)

## TypeScript

### 필수

- 새 제품 코드는 JavaScript 대신 TypeScript로 작성한다.
- 컴파일러의 strict 검사를 전제로 작성한다.
- `any`를 사용하지 않는다. 외부 입력은 `unknown`으로 받은 뒤 타입을 좁힌다.
- API 요청·응답 타입은 로컬 API 계약과 같은 필드명과 nullable 의미를 유지한다.
- `as` 단언은 런타임 검증이나 타입 관계로 안전성이 보장될 때만 사용한다.
- non-null assertion(`!`)으로 nullable 처리를 우회하지 않는다.
- enum 대신 문자열 리터럴 union 또는 기존 프로젝트 타입을 우선한다. 네이티브
  브리지나 외부 계약이 enum을 요구하면 해당 계약을 그대로 따른다.
- 사용하지 않는 import, 변수와 타입을 남기지 않는다.
- 들여쓰기는 탭 없이 공백 두 칸을 사용한다.

## 이름과 파일

### 필수

- 화면과 컴포넌트 이름은 `UpperCamelCase`를 사용한다.
- 함수, 변수, props와 유틸리티는 `lowerCamelCase`를 사용한다.
- 커스텀 Hook 이름은 `use`로 시작한다.
- 고정 상수는 `UPPER_SNAKE_CASE`를 사용한다.
- 사용자 이벤트를 처리하는 내부 함수는 `handleSave`, `handlePress`처럼
  `handle`로 시작하고, 콜백 prop은 `onSave`, `onPress`처럼 `on`으로 시작한다.
- 컴포넌트·화면 파일은 `UpperCamelCase.tsx`, Hook은 `useName.ts`,
  일반 유틸리티는 `lowerCamelCase.ts`를 사용한다.
- 테스트 파일은 대상 파일 옆 또는 모듈의 테스트 폴더에서
  `Name.test.ts`·`Name.test.tsx` 형식을 사용한다.

## 컴포넌트와 Hook

### 필수

- 함수 컴포넌트를 사용한다.
- Hook은 컴포넌트 또는 커스텀 Hook의 최상위에서만 호출한다.
- 조건문, 반복문, 이벤트 핸들러와 일반 함수 안에서 Hook을 호출하지 않는다.
- props 타입은 컴포넌트의 입력 의미가 드러나도록 명시한다.
- 파생 가능한 값은 별도 state에 중복 저장하지 않는다.
- 렌더링 중 외부 상태 변경, 네트워크 요청과 네이티브 호출을 실행하지 않는다.
- effect에서 등록한 listener, timer와 subscription은 cleanup에서 정리한다.
- `useMemo`와 `useCallback`은 기본값으로 남용하지 않고 참조 안정성 또는 실제
  계산 비용이 필요한 경우에만 사용한다.

### 권장

- 화면은 데이터 연결과 내비게이션을 조정하고 재사용 UI는 컴포넌트로 분리한다.
- 컴포넌트가 여러 책임을 가지거나 props 의미가 불명확해지면 도메인 기준으로
  분리한다.
- props를 중간 계층으로 과도하게 전달해야 할 때만 상태 관리 경계를 검토한다.

## import와 모듈 경계

- import는 외부 패키지, 프로젝트 절대 경로, 상대 경로 순으로 그룹화한다.
- 그룹 사이에는 빈 줄 하나를 둔다.
- 순환 의존성을 만들지 않는다.
- 다른 도메인의 내부 파일을 직접 참조하지 않고 해당 도메인의 공개 진입점을
  사용한다.
- 타입만 사용하는 import는 `import type`을 사용한다.
- Kotlin 네이티브 모듈은 AI 전화 화면·통화 엔진과 푸시 등록 토큰 두 경계에서만
  사용한다. 푸시 경계는 FCM 등록 토큰의 발급과 갱신 전달까지만 담당하고
  서비스 API를 직접 호출하지 않는다. 그 외 모바일 기능을 Kotlin으로 옮기거나
  새로운 브리지를 만들지 않는다. 제품 경계는
  [`../specs/COMMON.md`](../specs/COMMON.md)를 따른다.

## UI와 스타일

### 필수

- 프로젝트가 선택한 스타일링 방식 안에서 구현하고 같은 컴포넌트에서 여러
  스타일 체계를 임의로 섞지 않는다.
- 반복되는 색상, 간격과 글꼴 값을 화면마다 하드코딩하지 않고 프로젝트 토큰을
  사용한다.
- 누를 수 있는 요소에는 역할과 충분한 터치 영역을 제공한다.
- 이미지와 아이콘에는 필요한 접근성 설명을 제공하고 장식 목적이면 접근성
  트리에서 제외한다.
- 목록의 key에 배열 index를 사용하지 않는다. 항목의 안정적인 식별자를 사용한다.
- 사용자에게 표시되는 비동기 작업은 로딩, 성공, 빈 결과와 오류 상태를 구분한다.

## 비동기 처리와 네이티브 브리지

- Promise rejection을 처리하지 않은 채 남기지 않는다.
- 화면이 사라진 뒤 state를 갱신하거나 listener가 남지 않도록 수명을 정리한다.
- 네이티브 브리지의 입력·출력 타입과 오류는 명시적으로 정의한다.
- 브리지에 Access Token 이외의 비밀값을 저장하거나 OpenAI API 키를 전달하지
  않는다.
- 브리지 계약을 변경할 때 Kotlin과 TypeScript 양쪽 타입 및 테스트를 함께
  갱신한다.

## 검증

- 모듈에 정의된 ESLint, Prettier 검사와 TypeScript 타입 검사를 실행한다.
- 변경한 화면·Hook·유틸리티의 관련 테스트를 실행한다.
- 검사 스크립트가 구성되지 않은 상태에서는 패키지나 설정을 임의로 추가하지
  않고 `NOT CONFIGURED`로 보고한 뒤 이 문서 기준으로 수동 점검한다.
