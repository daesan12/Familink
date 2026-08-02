#!/usr/bin/env bash
set -Eeuo pipefail

image_tag="${1:-}"
app_root="${APP_ROOT:-/home/ssm-user/S15P11B104}"
compose_file="$app_root/infrastructure/production/compose.prod.yml"
env_file="$app_root/infrastructure/production/.env"
state_dir="$app_root/infrastructure/production/.deployment"
repository="${ECR_REPOSITORY:-familink-backend}"
region="${AWS_REGION:-ap-northeast-2}"
public_health_url="${HEALTH_CHECK_URL:-https://api.familink360.com/actuator/health}"

if [[ ! "$image_tag" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'a full 40-character Git commit SHA is required\n' >&2
  exit 2
fi

if [[ ! -f "$env_file" ]]; then
  printf 'production environment file is missing: %s\n' "$env_file" >&2
  exit 2
fi

account_id="$(aws sts get-caller-identity --query Account --output text)"
registry="$account_id.dkr.ecr.$region.amazonaws.com"
new_image="$registry/$repository:$image_tag"
previous_image="$(docker inspect --format '{{.Config.Image}}' familink-production-backend-1 2>/dev/null || true)"

if [[ -z "$previous_image" && -f "$state_dir/current-image" ]]; then
  previous_image="$(cat "$state_dir/current-image")"
fi

install -d -m 700 "$state_dir"
printf '%s\n' "$new_image" > "$state_dir/pending-image"
chmod 600 "$state_dir/pending-image"

rollback_on_error() {
  exit_code=$?
  trap - ERR
  printf 'deployment failed; starting rollback\n' >&2

  if [[ -n "$previous_image" ]] && APP_ROOT="$app_root" HEALTH_CHECK_URL="$public_health_url" \
    bash "$app_root/infrastructure/production/scripts/rollback.sh" "$previous_image"; then
    rm -f "$state_dir/pending-image"
    printf 'DEPLOY_STATUS=rollback-success\n'
    exit 42
  fi

  printf 'DEPLOY_STATUS=rollback-failed\n' >&2
  exit 43
}
trap rollback_on_error ERR

aws ecr get-login-password --region "$region" \
  | docker login --username AWS --password-stdin "$registry"
docker pull "$new_image"

export BACKEND_IMAGE="$new_image"
docker compose --env-file "$env_file" -f "$compose_file" up -d --no-build backend

for attempt in {1..18}; do
  if docker compose --env-file "$env_file" -f "$compose_file" exec -T backend \
    curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8080/actuator/health \
    | grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"'; then
    break
  fi
  if [[ "$attempt" -eq 18 ]]; then
    printf 'new backend did not become healthy\n' >&2
    false
  fi
  sleep 5
done

docker compose --env-file "$env_file" -f "$compose_file" exec -T nginx nginx -s reload
sh "$app_root/infrastructure/production/scripts/health-check.sh" "$public_health_url" 12 5

printf '%s\n' "$new_image" > "$state_dir/current-image"
chmod 600 "$state_dir/current-image"
rm -f "$state_dir/pending-image"
trap - ERR
printf 'DEPLOY_STATUS=success\n'
printf 'deployed image: %s\n' "$new_image"
