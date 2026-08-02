#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
CLOUDWATCH_NAMESPACE="${CLOUDWATCH_NAMESPACE:-Familink/Health}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-familink-production}"

container_id() {
  local service="$1"
  docker ps \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.service=${service}" \
    --format '{{.ID}}' | head -n 1
}

backend_health=0
backend_container="$(container_id backend)"
if [[ -n "$backend_container" ]] && docker exec "$backend_container" \
  curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:8080/actuator/health >/dev/null; then
  backend_health=1
fi

redis_health=0
redis_container="$(container_id redis)"
if [[ -n "$redis_container" ]] && [[ "$(docker inspect --format '{{.State.Health.Status}}' "$redis_container")" == "healthy" ]]; then
  redis_health=1
fi

metric_data="$(printf '[{"MetricName":"BackendHealth","Dimensions":[{"Name":"Service","Value":"backend"}],"Value":%s,"Unit":"Count"},{"MetricName":"RedisHealth","Dimensions":[{"Name":"Service","Value":"redis"}],"Value":%s,"Unit":"Count"}]' "$backend_health" "$redis_health")"

aws cloudwatch put-metric-data \
  --region "$AWS_REGION" \
  --namespace "$CLOUDWATCH_NAMESPACE" \
  --metric-data "$metric_data"
