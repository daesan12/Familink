# Kotlin 코드 컨벤션

> 기준: Kotlin 공식 Coding conventions, 2026-07-28 확인
> 적용 범위: 프로젝트의 모든 `*.kt`, `*.kts` 파일

이 문서는 AI 전화 화면·통화 엔진을 포함한 Kotlin 코드와 Gradle Kotlin DSL의
구현 기준이다. 공통 운영 방식은 [`README.md`](./README.md)를 따른다.

## 기준 자료

- [Kotlin Coding conventions](https://kotlinlang.org/docs/coding-conventions.html)
- [Kotlin code quality tools](https://kotlinlang.org/docs/jvm-code-analysis.html)

## 파일과 구조

### 필수

- 파일 이름은 최상위 클래스 또는 주요 선언의 이름과 맞춘다.
- 서로 밀접한 작은 선언만 같은 파일에 둔다. 책임이 다른 공개 타입을 한 파일에
  모으지 않는다.
- 파일 순서는 상수·프로퍼티, 초기화 블록, 생성자, 공개 함수, 비공개 함수처럼
  읽는 흐름이 자연스럽도록 유지한다.
- 세미콜론을 사용하지 않는다.
- 사용하지 않는 import와 선언을 남기지 않는다.
- Java 스타일 getter·setter 대신 프로퍼티를 사용한다.

## 이름

### 필수

- 클래스, 인터페이스, `object`, enum 항목은 `UpperCamelCase`를 사용한다.
- 함수, 프로퍼티, 지역 변수와 매개변수는 `lowerCamelCase`를 사용한다.
- 컴파일 타임 상수와 변경되지 않는 최상위 상수는 `UPPER_SNAKE_CASE`를 사용한다.
- 테스트 함수 이름은 문장형 backtick 이름 또는 프로젝트의 기존 테스트 이름
  스타일 중 해당 모듈에서 사용 중인 한 가지 방식을 유지한다.
- 컬렉션은 복수형, 단일 값은 단수형으로 이름을 짓는다.
- Boolean은 `is`, `has`, `can`, `should`처럼 참·거짓 의미가 드러나게 한다.

## 포맷

### 필수

- 들여쓰기는 탭 없이 공백 네 칸을 사용한다.
- 여는 중괄호는 선언문 마지막에 두고 닫는 중괄호는 별도 줄에 둔다.
- 여러 줄 매개변수와 인수는 한 줄에 하나씩 쓰고 공백 네 칸을 들여쓴다.
- 여러 줄 선언에서는 마지막 항목 뒤에 trailing comma를 사용한다.
- 긴 식 본문은 `=`을 첫 줄 끝에 두고 다음 줄을 네 칸 들여쓴다.
- 한 줄에 문장 하나만 작성하고 줄 끝 공백을 남기지 않는다.

```kotlin
fun createCallSession(
    personaId: Long,
    sdpOffer: String,
): CallSession =
    callSessionRepository.create(
        personaId = personaId,
        sdpOffer = sdpOffer,
    )
```

## Kotlin 사용 원칙

### 필수

- nullable 값은 안전 호출, Elvis 연산자, 명시적 분기 또는 입력 검증으로 처리한다.
- `!!`는 외부 계약이나 바로 앞 검증으로 null 불가능성이 증명되고 더 안전한
  표현이 없는 경우에만 사용하며 이유를 남긴다.
- 빈 `catch` 블록과 처리하지 않는 예외 삼키기를 금지한다.
- 함수가 단일 식으로 명확하게 표현될 때만 식 본문을 사용한다.
- 타입이 문맥에서 명확할 때 지역 변수 타입은 생략할 수 있다. 공개 API와
  반환 의미가 모호한 선언은 타입을 명시한다.
- `var`보다 `val`을 우선한다.
- 컬렉션을 외부에 노출할 때 변경 가능 구현 타입보다 읽기 전용 타입을 우선한다.

### 권장

- 중첩 분기를 줄일 수 있으면 guard clause를 사용한다.
- 범위 함수는 수신 객체와 반환값의 의미가 명확할 때만 사용한다. 연속된
  `let`, `run`, `apply`, `also` 체인은 피한다.
- 확장 함수는 해당 타입에 자연스럽고 재사용 가능한 동작에만 사용한다.

## 코루틴과 Android

### 필수

- `GlobalScope`를 사용하지 않는다.
- 수명주기가 있는 작업은 해당 `CoroutineScope`에 연결한다.
- dispatcher 선택과 변경은 호출 계층에서 예측 가능하게 유지한다.
- 취소 예외를 일반 실패로 삼키지 않는다.
- Flow와 콜백의 수집·등록은 수명주기 종료 시 함께 정리한다.
- AI 전화 전용 Kotlin 경계를 넘어 React Native 영역의 화면을 Kotlin으로
  새로 구현하지 않아 현재 제품 경계를 유지한다.

## Compose

- Composable 함수는 `UpperCamelCase`를 사용한다.
- 상태는 가능한 한 호출자에게 끌어올리고 Composable은 명시적인 값과 이벤트를
  입력으로 받는다.
- Composable 안에서 장시간 작업이나 직접적인 네트워크 호출을 실행하지 않는다.
- 재구성 과정에서 새로 생성되면 안 되는 값은 적절한 상태 또는 effect API로
  수명을 관리한다.
- 접근성 의미, 클릭 역할과 사용자에게 필요한 설명을 생략하지 않는다.

## 검증

- ktlint가 구성되면 해당 모듈의 `ktlintCheck`를 실행한다.
- Android Kotlin을 변경하면 관련 단위 테스트와 모듈 빌드를 함께 실행한다.
- ktlint가 구성되지 않은 상태에서는 설치를 임의로 추가하지 않고
  `NOT CONFIGURED`로 보고한 뒤 이 문서 기준으로 수동 점검한다.
