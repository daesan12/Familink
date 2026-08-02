#!/usr/bin/env bash
set -Eeuo pipefail

app_root="${APP_ROOT:-/home/ssm-user/S15P11B104}"
compose_file="$app_root/infrastructure/production/compose.prod.yml"
env_file="$app_root/infrastructure/production/.env"
state_dir="$app_root/infrastructure/production/.deployment"
previous_image="${1:-}"
public_health_url="${HEALTH_CHECK_URL:-https://api.familink360.com/actuator/health}"

if [[ -z "$previous_image" ]]; then
  printf 'rollback image is empty\n' >&2
  exit 1
fi

if [[ ! -f "$env_file" ]]; then
  printf 'production environment file is missing: %s\n' "$env_file" >&2
  exit 1
fi

if ! docker image inspect "$previous_image" >/dev/null 2>&1; then
  registry="${previous_image%%/*}"
  aws ecr get-login-password --region "${AWS_REGION:-ap-northeast-2}" \
    | docker login --username AWS --password-stdin "$registry"
  docker pull "$previous_image"
fi

export BACKEND_IMAGE="$previous_image"
docker compose --env-file "$env_file" -f "$compose_file" up -d --no-build backend

for attempt in {1..18}; do
  if docker compose --env-file "$env_file" -f "$compose_file" exec -T backend \
    curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8080/actuator/health \
    | grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"'; then
    break
  fi
  if [[ "$attempt" -eq 18 ]]; then
    printf 'rolled-back backend did not become healthy\n' >&2
    exit 1
  fi
  sleep 5
done

docker compose --env-file "$env_file" -f "$compose_file" exec -T nginx nginx -s reload
sh "$app_root/infrastructure/production/scripts/health-check.sh" "$public_health_url" 12 5

install -d -m 700 "$state_dir"
printf '%s\n' "$previous_image" > "$state_dir/current-image"
chmod 600 "$state_dir/current-image"
printf 'rollback completed: %s\n' "$previous_image"
