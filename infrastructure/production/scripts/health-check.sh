#!/usr/bin/env sh
set -eu

health_url="${1:-http://127.0.0.1/actuator/health}"
max_attempts="${2:-12}"
delay_seconds="${3:-5}"
attempt=1

while [ "$attempt" -le "$max_attempts" ]; do
  response="$(curl --location --fail --silent --show-error --max-time 10 "$health_url" 2>/dev/null || true)"

  if printf '%s\n' "$response" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"'; then
    printf 'health check passed: %s\n' "$health_url"
    exit 0
  fi

  if [ "$attempt" -lt "$max_attempts" ]; then
    sleep "$delay_seconds"
  fi
  attempt=$((attempt + 1))
done

printf 'health check failed after %s attempts: %s\n' "$max_attempts" "$health_url" >&2
exit 1
