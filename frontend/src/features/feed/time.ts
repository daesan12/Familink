const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

// 백엔드가 주는 ISO-8601(UTC) 시각을 화면 표시 문자열로 바꾼다.
// 표시 규칙은 경과 시간 기준의 임시안이며, 최종 표시 스펙이 확정되면 조정한다.
// 데이터에는 항상 원본 ISO 시각만 저장하고, 표시 시점에만 이 함수로 변환한다.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) {
    return '';
  }

  // 미래 시각(기기 간 클럭 스큐 등으로 diff가 음수)도 '방금 전'으로 처리한다.
  const diff = now.getTime() - target;
  if (diff < MINUTE_MS) {
    return '방금 전';
  }
  if (diff < HOUR_MS) {
    return `${Math.floor(diff / MINUTE_MS)}분 전`;
  }
  if (diff < DAY_MS) {
    return `${Math.floor(diff / HOUR_MS)}시간 전`;
  }
  if (diff < WEEK_MS) {
    return `${Math.floor(diff / DAY_MS)}일 전`;
  }

  const date = new Date(target);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}
