# CodeGraph

- 코드 탐색에는 CodeGraph를 우선 사용한다.
- CodeGraph 결과에 stale 경고가 있으면 실제 파일을 다시 확인한다.
- CodeGraph를 사용할 수 없으면 일반 코드 검색과 파일 읽기로 대체한다.
- `.codegraph/`의 데이터베이스, 로그, PID 파일은 커밋하지 않는다.
