# CHG-S15P11B104-253 로그인 시도 제한 계약 반영

- 승인 범위: 전체 제안
- 결정: 15분 내 실패 5회, 1초 시작 지수 backoff, 최대 차단 300초, `429 LOGIN_RATE_LIMITED`와 `Retry-After`
- 추가 결정: loginId 최대 15자, password 최대 16자; 요청 출처는 Spring이 해석한 remote address 사용
- 승인 근거: 사용자 승인(통합 hardening 작업 진행)
- 반영 문서: `docs/specs/contracts/API.md`, `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/domains/FEED_AND_MEDIA.md`
