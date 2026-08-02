#!/usr/bin/env bash
set -Eeuo pipefail

region="${1:?AWS region is required}"
command_id="${2:?SSM command ID is required}"
instance_id="${3:?EC2 instance ID is required}"
max_attempts="${SSM_WAIT_ATTEMPTS:-90}"

for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
  status="$(aws ssm get-command-invocation \
    --region "$region" \
    --command-id "$command_id" \
    --instance-id "$instance_id" \
    --query Status \
    --output text 2>/dev/null || true)"

  case "$status" in
    Success)
      printf 'SSM deployment command succeeded\n'
      exit 0
      ;;
    Failed|Cancelled|TimedOut|Cancelling)
      output="$(aws ssm get-command-invocation \
        --region "$region" \
        --command-id "$command_id" \
        --instance-id "$instance_id" \
        --query StandardOutputContent \
        --output text 2>/dev/null || true)"
      error_output="$(aws ssm get-command-invocation \
        --region "$region" \
        --command-id "$command_id" \
        --instance-id "$instance_id" \
        --query StandardErrorContent \
        --output text 2>/dev/null || true)"

      if printf '%s\n%s\n' "$output" "$error_output" | grep -q 'DEPLOY_STATUS=rollback-success'; then
        exit 42
      fi
      if printf '%s\n%s\n' "$output" "$error_output" | grep -q 'DEPLOY_STATUS=rollback-failed'; then
        exit 43
      fi

      printf 'SSM deployment command ended with status: %s\n' "$status" >&2
      exit 1
      ;;
    Pending|InProgress|Delayed|'')
      sleep 10
      ;;
    *)
      printf 'unexpected SSM command status: %s\n' "$status" >&2
      exit 1
      ;;
  esac
done

printf 'SSM deployment command timed out while Jenkins was waiting\n' >&2
exit 1
