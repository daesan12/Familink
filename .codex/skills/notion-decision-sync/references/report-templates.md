# Report templates

Use concise Korean bullets and direct Notion links. Do not include an item number for content that is already reflected.

## Audit report

```markdown
최신 회의 및 추가 근거와 개발 문서를 비교했습니다.

- 최신 회의 기준: [제목](URL), 개최일 YYYY-MM-DD, 최종 수정 YYYY-MM-DD HH:mm KST
- 추가 근거: 사용자 제공 텍스트 또는 [문서](URL)
- 이미 반영: <짧은 주제 목록>

### 1. <주제>

- 상태: 일부 반영 | 미반영 | 충돌/판단 필요
- 회의 근거: <확정 내용 요약> — [원문](URL)
- 현재 상태: <현재 문서 내용> — [대상 문서](URL)
- 권장 변경: <최소한의 구체적 수정>
- 확인 필요: 없음 | <결정이 필요한 점>
- 반영 위치: <대상 페이지 또는 백엔드 전달사항>

원하는 처리를 한 번에 알려주세요.

예시:
1 반영
2 보류
3 <구체적인 수정 지시>
```

When multiple records share the latest meeting date, list each record and its last-edited time instead of presenting one as unquestionably newest.

## No-difference report

```text
최신 회의 및 추가 근거와 비교 완료. 현재 점검 범위에서 반영 누락이나 충돌이 없습니다.
```

Do not append an approval question.

## Mutation report

```markdown
승인된 항목만 반영하고 수정된 페이지를 다시 확인했습니다.

- 1. 반영 완료 — [수정 페이지](URL)
  - 실제 반영: <검증한 핵심 내용>
- 2. 보류 — 문서 변경 없음
- 3. 추가 확인 필요 — <중간 변경 또는 남은 충돌> — [현재 페이지](URL)
```

If a write succeeded but the verification fetch does not prove the saved state, use `반영 실패` or `추가 확인 필요`; never label it complete.

## Broken-scope report

```markdown
점검을 중단했습니다. 지정된 범위 안에서 다음 링크를 확인할 수 없습니다.

- 대상: <페이지 이름 또는 역할>
- 링크: <URL>
- 필요한 확인: <권한 부여, 연결 복구, 또는 새 정확한 링크>

다른 워크스페이스 페이지는 검색하거나 수정하지 않았습니다.
```
