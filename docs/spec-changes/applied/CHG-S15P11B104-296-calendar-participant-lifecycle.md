# 그룹 이탈 구성원의 일정 참여자 연결 정리

- 상태: 승인·반영
- 제안자: 홍유라
- 작성일: 2026-08-04
- 차단 변경: 예
- 영향 스펙·계약: `CALENDAR`, `GROUPS_AND_MEMBERSHIP`, `ACCOUNT_AND_PROFILE`, `API-CALENDAR-002~004`, `DATA_MODEL.calendar_events`, `DATA_MODEL.event_participants`
- 관련 작업: `S15P11B104-296`

## 기존 내용

- `docs/specs/domains/CALENDAR.md`는 일정에 그룹 구성원을 참여자로 연결할 수 있고, 일정 시작 알림은 현재 활성 참여자에게만 보낸다고 정의한다.
- `docs/specs/domains/GROUPS_AND_MEMBERSHIP.md`와 `docs/specs/contracts/DATA_MODEL.md`는 그룹 탈퇴·내보내기 시 `group_members.left_at`을 기록하고 멤버십 행을 보존한다고 정의한다.
- `docs/specs/domains/ACCOUNT_AND_PROFILE.md`는 회원 탈퇴 시 활성 그룹 멤버십을 종료하고 기존 서비스 기록을 보존한다고 정의한다.
- 일정 참여자로 지정된 구성원이 그룹에서 이탈할 때 `event_participants` 연결을 삭제할지, 재가입 시 과거 참여가 복원되는지, 마지막 참여자 삭제 후 일정 알림 범위를 어떻게 유지할지는 명시하지 않는다.

## 제안 내용

1. 본인 그룹 탈퇴, 관리자의 구성원 내보내기, 회원 탈퇴로 멤버십이 비활성화되면 같은 트랜잭션에서 해당 `group_members.id`를 참조하는 `event_participants` 연결을 모두 삭제한다.
2. 참여자 연결 삭제는 대상 멤버십과 같은 그룹의 일정으로 제한하며 일정, 일정 작성자, 다른 참여자와 멤버십 이력은 유지한다.
3. 일정 상세과 편집 응답의 `participantMemberIds`에는 현재 활성 그룹 구성원만 포함한다.
4. 이탈했던 구성원이 같은 멤버십 행으로 재가입해도 과거 일정 참여자 연결을 자동 복원하지 않는다.
5. 일정은 "참여자를 명시적으로 지정한 범위"인지 별도 상태로 보존한다. 지정 참여자가 이탈해 활성 참여자가 0명이 되어도 그룹 전체를 일정 시작 알림 대상으로 확대하지 않는다. 사용자가 일정 편집에서 참여자를 명시적으로 모두 해제한 경우에만 참여자 미지정 일정으로 전환한다.
6. 기존 데이터에서 비활성 멤버십을 참조하는 `event_participants`를 마이그레이션으로 정리하고, 참여자 지정 여부 상태를 기존 연결을 기준으로 보존한다.

## 변경 근거

- 사용자 결정: 그룹에서 나가거나 관리자에게 내보내지거나 회원 탈퇴한 구성원이 공유 일정 참여자 태그에 `구성원 {ID}`로 남지 않아야 한다.
- 현재 코드는 멤버십의 `left_at`만 갱신하고 참여자 연결을 남기며, 모바일은 활성 구성원 목록에서 찾지 못한 ID를 `구성원 {ID}`로 표시한다.
- 단순 연결 삭제만 수행하면 마지막 지정 참여자가 이탈한 일정을 참여자 미지정 일정으로 오인해 그룹 전체 알림으로 확대할 수 있으므로 참여자 지정 범위를 별도로 보존해야 한다.

## 확인된 영향

- 영향 도메인: 캘린더, 그룹·멤버십, 계정 탈퇴, 일정 시작 알림
- 영향 계약: 일정 상세·수정의 참여자 목록 의미, `calendar_events`와 `event_participants` 데이터 수명주기
- 영향 화면: 공유 캘린더 일정 상세·편집의 참여자 태그
- 검증 범위: 본인 그룹 탈퇴, 관리자 내보내기, 다중 그룹 회원 탈퇴, 재가입, 기존 데이터 마이그레이션, 마지막 참여자 이탈 후 알림 대상, 동시 일정 저장·멤버십 이탈

## 결정 및 반영

- 결정: 전체 승인
- 결정자: 홍유라
- 결정일: 2026-08-04
- 반영 문서: `docs/specs/domains/CALENDAR.md`, `docs/specs/domains/GROUPS_AND_MEMBERSHIP.md`, `docs/specs/domains/ACCOUNT_AND_PROFILE.md`, `docs/specs/contracts/API.md`, `docs/specs/contracts/DATA_MODEL.md`, `docs/specs/COVERAGE.md`
- 반영 커밋:
