# CloudWatch 운영 관측 구성

이 디렉터리는 200번 운영 환경에서 사용할 EC2 호스트 지표와 Docker 로그 설정을 관리합니다.

## AWS 콘솔에서 먼저 만들 항목

서울 리전(`ap-northeast-2`)에서 다음 로그 그룹을 생성합니다.

- `/familink/prod/backend`
- `/familink/prod/nginx`
- `/familink/prod/deploy`

EC2 IAM Role에는 `infrastructure/aws-foundation/iam/ec2-instance-policy.json`의
`PublishProductionMetrics`, `DescribeProductionLogStreams`, `WriteProductionLogStreams`
권한을 추가합니다. `<AWS_ACCOUNT_ID>`는 실제 계정 ID로 바꿉니다.

## EC2에서 CloudWatch Agent 설치

SSM Session Manager로 EC2에 접속한 뒤 Agent를 설치하고 설정 파일을 복사합니다.

```text
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc
sudo cp infrastructure/production/cloudwatch/amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
  -s
```

Agent는 EC2의 CPU·메모리·디스크·디스크 I/O·네트워크·Swap 지표를 `Familink/EC2` 네임스페이스로 보냅니다.

## Backend·Redis 헬스 지표

Docker health 상태는 CloudWatch Agent가 기본으로 수집하지 않으므로, 저장소의
`scripts/publish-cloudwatch-health.sh`를 systemd timer로 1분마다 실행합니다.

```text
sudo install -d /opt/familink/infrastructure/production/scripts
sudo cp infrastructure/production/scripts/publish-cloudwatch-health.sh /opt/familink/infrastructure/production/scripts/
sudo cp infrastructure/production/systemd/familink-health-metrics.service /etc/systemd/system/
sudo cp infrastructure/production/systemd/familink-health-metrics.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now familink-health-metrics.timer
sudo systemctl start familink-health-metrics.service
sudo journalctl -u familink-health-metrics.service -n 50 --no-pager
```

이 작업은 EC2 IAM Role의 AWS CLI 자격증명을 사용하며 비밀키를 파일에 저장하지 않습니다.
`Familink/Health` 네임스페이스에 `BackendHealth`와 `RedisHealth`를 0 또는 1로 기록합니다.

## Docker 로그

Backend와 Nginx는 Compose의 `awslogs` 드라이버로 각각 다음 로그 그룹에 전송합니다.

- Backend: `/familink/prod/backend`
- Nginx: `/familink/prod/nginx`

로그 그룹은 Compose 실행 전에 생성해야 하며, CloudWatch Agent가 같은 컨테이너 로그를 다시 수집하지 않도록 중복 수집하지 않습니다.

## 알람 기준

CloudWatch Dashboard와 Alarm은 다음 지표를 기준으로 구성합니다.

- CPU 사용률 80% 이상
- 메모리 사용률 85% 이상
- 루트 디스크 사용률 80% 이상
- EC2 Status Check 실패
- RDS CPU·연결 수·저장 공간
- Redis 메모리 사용량
- BackendHealth가 0인 상태
- RedisHealth가 0인 상태

Redis 메모리 사용량은 CloudWatch Agent의 `procstat` Redis 프로세스 지표를 기준으로 별도 Alarm을 만듭니다.

운영 장애 알림을 Mattermost로 보내는 것은 이 티켓의 범위가 아닙니다. 이번 티켓에서는 CloudWatch Dashboard와 Alarm에서 상태를 확인합니다.
