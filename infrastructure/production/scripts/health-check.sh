#!/usr/bin/env sh
set -eu

health_url="${1:-http://127.0.0.1/actuator/health}"
response="$(curl --fail --silent --show-error --max-time 10 "$health_url")"

printf '%s\n' "$response" | grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"'
printf 'health check passed: %s\n' "$health_url"
