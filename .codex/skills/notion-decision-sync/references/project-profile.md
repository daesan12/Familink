# 2 AI project profile

This profile defines the maximum Notion scope and current write routing for S15P11B104. Fetch the root on every run because links and document structure can change.

## Root

- User-facing label: `2 AI`
- Canonical title observed on 2026-07-22: `[싸피 2학기 공통프로젝트] 돌봄 AI 전화 서비스`
- User-provided root URL: https://app.notion.com/p/2-AI-a07e66fae192822d8862011c73e2305e
- Canonical URL returned by the Notion plugin: https://app.notion.com/p/a07e66fae192822d8862011c73e2305e
- Required connector: Notion plugin (`plugin://notion@openai-curated-remote`)

The current root content, not this snapshot, determines which direct links remain connected. The URLs below are identity anchors and safe starting points, not permission to recover disconnected pages through global search.

## Meeting scope

Fetch these pages from the root's `회의록` area and include only their directly linked records:

- 일간 보고: https://app.notion.com/p/3b5e66fae192820998030167ce54fec1
- 정기 회의: https://app.notion.com/p/4d6e66fae19283e9945a81ac3ad44adc
- 요청 사항: https://app.notion.com/p/966e66fae19282edb54d01ebce0a86d6

Do not inspect meeting pages elsewhere in the workspace unless the user supplies an exact page as additional evidence.

## Development-document scope

The root's `Software Architecture` area currently links these stage documents. A directly linked database or container includes its direct records.

### Planning

- 아이디어 구체화: https://app.notion.com/p/f9ae66fae19283a4aa128112e5e42185
- 프로젝트 기획서: https://app.notion.com/p/399e66fae19280eb9e7cd99616fc0f3e
- 시장조사 / 벤치마킹 문서: https://app.notion.com/p/399e66fae19281608084caf7c8fac2fe
- 요구사항 정의서: https://app.notion.com/p/399e66fae192805aabe8f07d2c5b36b2
- 1차 와이어프레임: https://app.notion.com/p/bbce66fae19283f9ac2c81a7c17038f8
- 사용자 흐름도(User Flow): https://app.notion.com/p/399e66fae1928078a5dee95aa398645d
- 사용자 시나리오: https://app.notion.com/p/399e66fae192807e8080e86f45b7f7ad
- 기술적 의사결정: https://app.notion.com/p/b41e66fae192830cabb881a7da4b5e10
- 두 번째 `프로젝트 기획서` 링크: https://app.notion.com/p/957e66fae192824495348107975860f8

Do not collapse the two project-plan links based on title alone. Fetch both and use their current content and connections to determine relevance.

### Design

- 데이터 모델링 (ERD): https://app.notion.com/p/2aee66fae192821c8c8101ef1ede4025
- 기능 명세서: https://app.notion.com/p/399e66fae19280e4839bf2cb4698008a
- API 명세서: https://app.notion.com/p/448e66fae19282249cb4813815821614
- 2차 와이어프레임: https://app.notion.com/p/cc5e66fae19283ec9a7f01dc389d5dfb
- 주요 로직 설계: https://app.notion.com/p/2afe66fae1928348bd86014fc6ae8101
- API 명세서 (따흑따): https://app.notion.com/p/3a5e66fae19280f6ab4dfeef2f5f91fc

### Development

- 개발 과정 (Agile): https://app.notion.com/p/04ce66fae192835582ce814b4ea75b27
- 개발 과정 (Waterfall): https://app.notion.com/p/19fe66fae19282b69e768186521e4fe7

### Test

- 단위 테스트 (TDD): https://app.notion.com/p/ddde66fae1928241aa5501eaa7a20170
- 통합 테스트: https://app.notion.com/p/cb5e66fae19283dcadb8013b48ccf71e
- 회귀 테스트: https://app.notion.com/p/a87e66fae192820a8cfb81d9f0a935a8
- E2E 테스트: https://app.notion.com/p/0d1e66fae19282dcb6ff010d443a971f
- User Test: https://app.notion.com/p/383e66fae19282e29f690115c0644ceb

### ERD and API specifications

- Read ERD and API specifications when needed to identify differences.
- When the user explicitly approves an exact change, edit the relevant ERD or API source page directly and re-fetch it for verification.
- Record remaining backend implementation work or coordination notes in `백엔드에게 전달사항` when useful:
  https://app.notion.com/p/3a5e66fae192806e966cc09a8ed025ac
- Keep that handoff concise and grounded in confirmed decisions. Do not add speculative error codes, retry policies, concurrency controls, cleanup jobs, or extra schema fields.

### Deferred features

- Long-term memory is currently deferred as an extension. Do not promote it into MVP documents unless the user provides a new explicit decision.
- Do not encode current emotion categories, model names, schema values, or other decision facts in this profile. Fetch their latest source documents every run.

## Per-run overrides

The user's current request may exclude additional documents or designate an exact page as an additional source or handoff destination. Apply that override only for the current run. If it would permit writes outside this root, require explicit confirmation and never broaden the surrounding search area.
