# Familink Jenkins CI/CD 설정

Jenkins는 SSAFY 제공 EC2에서 테스트와 이미지 빌드를 수행합니다. 운영 애플리케이션은 개인 AWS EC2에 있으며, Jenkins가 운영 서버에 직접 로그인하지 않고 AWS Systems Manager(SSM)에 배포 명령을 전달합니다.

## 브랜치별 동작

| GitLab 이벤트 | Jenkins 동작 |
| --- | --- |
| `feature/*` Push | 테스트, BootJar 빌드 |
| `develop` 대상 MR | 테스트, BootJar 빌드 |
| `develop` 병합 | 테스트, BootJar, Docker 이미지, ECR Push, staging 배포 |
| `main` 대상 MR | 테스트, BootJar 빌드 |
| `main` 병합 | 테스트, BootJar, Docker 이미지, ECR Push, SSM 운영 배포, health check, 실패 시 rollback |

MR은 Jenkins Multibranch Pipeline에서 `CHANGE_*` 환경변수를 가진 별도 빌드로 실행되므로 `develop` 또는 `main` 배포 단계에 진입하지 않습니다.

## 1. AWS 콘솔에서 준비할 항목

1. Amazon ECR에서 `familink-backend` Private Repository를 생성합니다.
2. ECR 저장소의 수명 주기 정책에 `infrastructure/production/ecr-lifecycle-policy.json`을 등록합니다.
3. IAM에서 Jenkins 전용 사용자를 만들고 `infrastructure/ci/jenkins-deploy-policy.json`의 Placeholder를 실제 AWS 계정 ID와 운영 EC2 ID로 바꾼 정책만 연결합니다.
4. 운영 EC2 Role에 ECR Pull 권한과 `/familink/prod/deploy` 로그 기록 권한이 포함되어 있는지 확인합니다.
5. Systems Manager의 관리형 노드 목록에서 운영 EC2가 `Online`인지 확인합니다.
6. CloudWatch Logs에 `/familink/prod/deploy` 로그 그룹이 존재하는지 확인합니다.

Jenkins 전용 IAM 사용자는 ECR Push와 지정된 운영 EC2의 SSM 배포만 담당합니다. AdministratorAccess를 연결하지 않습니다.

## 2. Jenkins 플러그인

Jenkins의 `Jenkins 관리 → Plugins`에서 다음 플러그인을 설치합니다.

- Pipeline
- GitLab
- GitLab Branch Source
- Credentials Binding
- Mattermost Notification

플러그인 설치 후 Jenkins를 안전하게 재시작합니다.

## 3. Jenkins Credentials

`Jenkins 관리 → Credentials → System → Global credentials`에 다음 ID로 저장합니다.

| ID | 종류 | 저장할 값 |
| --- | --- | --- |
| `familink-gitlab-token` | Secret text | GitLab Personal Access Token |
| `familink-aws-ecr` | Username with password | Username은 AWS Access Key ID, Password는 Secret Access Key |
| `familink-prod-instance-id` | Secret text | 운영 EC2 인스턴스 ID (`i-...`) |
| `familink-staging-env` | Secret file | SSAFY EC2 staging 전용 `.env` 파일 |
| `familink-mattermost-webhook` | Secret text | Mattermost Incoming Webhook URL |

비밀값을 Jenkinsfile, GitLab 변수, 빌드 로그에 직접 입력하지 않습니다.

## 4. Mattermost 설정

1. 배포 알림을 받을 Mattermost 채널을 만듭니다.
2. Mattermost 통합 메뉴에서 Incoming Webhook을 생성합니다.
3. 생성된 URL을 Jenkins의 `familink-mattermost-webhook` Secret text로 저장합니다.
4. Jenkinsfile의 `mattermostSend`는 배포 시작·성공·실패·rollback 결과와 Commit SHA를 전송합니다.

알림이 실패해도 실제 테스트나 배포 결과는 바뀌지 않습니다. Jenkins 빌드 결과가 배포의 기준이고 Mattermost는 알림 수단입니다.

## 5. Multibranch Pipeline 생성

1. Jenkins 첫 화면에서 `새로운 Item`을 누릅니다.
2. `Multibranch Pipeline`을 선택합니다.
3. Branch Sources에 GitLab 저장소와 `familink-gitlab-token`을 연결합니다.
4. Build Configuration의 Script Path는 `Jenkinsfile`로 둡니다.
5. GitLab Webhook을 등록하고 Push와 Merge Request 이벤트를 활성화합니다.
6. Scan Multibranch Pipeline을 실행해 `develop`, `main`, MR 빌드가 발견되는지 확인합니다.

## 6. SSAFY EC2 staging 준비

Jenkins 실행 계정이 Docker를 사용할 수 있어야 하며 Java 21, Docker, Docker Compose plugin, AWS CLI v2가 설치되어 있어야 합니다. 다음 예시를 복사한 뒤 staging 전용 값으로 채우고 Jenkins Secret file에 등록합니다.

```text
infrastructure/staging/.env.example
```

staging은 SSAFY EC2의 `127.0.0.1:18080`에만 backend를 열며 PostgreSQL과 Redis도 외부에 공개하지 않습니다.

## 7. 운영 배포 원리

1. Jenkins가 Git Commit SHA를 Docker 이미지 태그로 사용합니다.
2. Jenkins가 ECR에 이미지를 Push합니다.
3. Jenkins가 SSM으로 운영 EC2의 `deploy.sh`를 실행합니다.
4. 운영 EC2는 IAM Role로 ECR에 로그인하고 새 이미지를 Pull합니다.
5. backend 컨테이너만 새 이미지로 교체합니다. Nginx, Redis, 운영 `.env`는 유지합니다.
6. 내부 Actuator와 `https://api.familink360.com/actuator/health`를 확인합니다.
7. 실패하면 직전 컨테이너 이미지로 rollback합니다.

운영 EC2의 저장소 위치 기본값은 `/home/ssm-user/S15P11B104`입니다. MR이 병합된 뒤 운영 EC2에서 최신 `main` 또는 배포 기준 브랜치의 스크립트를 먼저 받아야 합니다.

## 8. 최초 검증 순서

1. feature 브랜치 Push에서 테스트와 BootJar만 실행되는지 확인합니다.
2. develop 병합에서 ECR 이미지와 staging 컨테이너가 생성되는지 확인합니다.
3. main MR에서는 운영 배포가 실행되지 않는지 확인합니다.
4. main 병합에서 Commit SHA 이미지가 운영에 배포되는지 확인합니다.
5. 의도적으로 존재하지 않는 이미지 태그를 배포해 rollback과 Mattermost 실패 알림을 확인합니다.
6. Jenkins 로그, ECR 태그, SSM 명령 이력, 운영 health check가 같은 Commit SHA를 가리키는지 확인합니다.
