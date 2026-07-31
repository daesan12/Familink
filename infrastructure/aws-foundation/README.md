# AWS 운영 기반 구성

S15P11B104-198에서 구성하는 AWS 네트워크·권한·접속 기반의 재현 절차다. 이 디렉터리에는 AWS 비밀값이나 계정별 리소스 ID를 저장하지 않는다.

## 범위

이 티켓은 다음 리소스를 서울 리전(`ap-northeast-2`)에 구성하는 작업이다.

- 프로젝트 전용 VPC와 Public·Private Subnet
- 운영 EC2와 Elastic IP
- Private Subnet의 PostgreSQL RDS
- EC2 IAM Role과 Systems Manager Session Manager
- Parameter Store `SecureString`
- 기존 S3 게시글 미디어 버킷 접근 권한

다음 작업은 별도 티켓에서 진행한다.

- 199: Spring Boot 운영 프로필, Docker Compose, Redis, Nginx
- 200: Route 53, HTTPS, CloudWatch
- 201: Jenkins, ECR, GitLab Webhook 자동 배포

## 공통 설정

| 항목 | 값 |
|---|---|
| 리전 | `ap-northeast-2` (서울) |
| VPC 이름 | `familink-prod-vpc` |
| VPC CIDR | `10.0.0.0/16` |
| 태그 `Project` | `Familink` |
| 태그 `Environment` | `prod` |
| 태그 `ManagedBy` | `manual` |

AWS 콘솔의 리전 선택기가 서울로 되어 있는지 모든 단계마다 확인한다. CIDR가 기존 VPC와 겹치면 다른 사설 대역을 임의로 바꾸지 말고 먼저 팀과 조정한다.

## 1. VPC와 Subnet

VPC 콘솔에서 `VPC only`로 VPC를 만든다. `VPC and more`를 선택하면 NAT Gateway가 자동 생성될 수 있으므로 이번 티켓에서는 사용하지 않는다.

| 이름 | 가용 영역 | CIDR | 용도 |
|---|---|---|---|
| `familink-prod-public-a` | `ap-northeast-2a` | `10.0.1.0/24` | 운영 EC2 |
| `familink-prod-private-a` | `ap-northeast-2a` | `10.0.11.0/24` | RDS Subnet Group |
| `familink-prod-private-c` | `ap-northeast-2c` | `10.0.12.0/24` | RDS Subnet Group |

가용 영역 이름이 계정에서 다르게 보이면 서로 다른 두 가용 영역을 사용하고, 실제 선택값을 배포 기록에 남긴다. RDS DB Subnet Group은 서로 다른 가용 영역의 Subnet을 2개 이상 요구한다.

### Internet Gateway와 Route Table

1. `familink-prod-igw`를 생성하고 `familink-prod-vpc`에 연결한다.
2. `familink-prod-public-rt`를 생성한다.
3. Public Route Table에 `0.0.0.0/0 → Internet Gateway` 경로를 추가한다.
4. `familink-prod-public-a`를 Public Route Table에 연결한다.
5. `familink-prod-private-rt`를 생성하고 두 Private Subnet을 연결한다.
6. Private Route Table에는 기본적으로 VPC 내부 통신 경로만 둔다. NAT Gateway는 이번 티켓에서 만들지 않는다.

Public Subnet의 EC2는 Session Manager와 패키지 저장소에 접근할 수 있고, RDS는 Private Subnet에 남는다. 나중에 EC2까지 Private Subnet으로 옮기면 NAT Gateway 또는 VPC Endpoint를 별도 설계해야 한다.

## 2. Security Group

### `familink-prod-ec2-sg`

Inbound 규칙:

| 프로토콜 | 포트 | 출처 | 설명 |
|---|---:|---|---|
| TCP | 80 | `0.0.0.0/0` | HTTP (200번에서 Nginx 사용) |
| TCP | 443 | `0.0.0.0/0` | HTTPS (200번에서 Nginx 사용) |

SSH 22와 Redis 6379는 추가하지 않는다. 기본 Outbound는 유지하되, 운영 정책이 정해지면 필요한 목적지로 좁힌다.

### `familink-prod-rds-sg`

Inbound 규칙:

| 프로토콜 | 포트 | 출처 | 설명 |
|---|---:|---|---|
| TCP | 5432 | `familink-prod-ec2-sg` | 운영 EC2에서만 PostgreSQL 접속 |

CIDR `0.0.0.0/0`이나 개인 PC의 공인 IP를 RDS에 등록하지 않는다. 로컬에서 확인해야 하면 Session Manager 포트 포워딩을 별도 사용한다.

## 3. EC2

EC2 생성값:

- 이름: `familink-prod-server`
- AMI: Ubuntu Server 24.04 LTS 64-bit
- 인스턴스 유형: `t3.medium`
- Subnet: `familink-prod-public-a`
- Public IPv4 자동 할당: 활성화
- Security Group: `familink-prod-ec2-sg`
- 루트 볼륨: `gp3`, 50GB
- IAM Instance Profile: `familink-prod-ec2-role`

생성 뒤 Elastic IP를 할당해 EC2에 연결한다. Session Manager를 기본 접속 방식으로 사용하므로 PEM 파일을 Git이나 문서에 저장하지 않는다.

## 4. IAM Role

IAM에서 EC2가 신뢰 주체인 `familink-prod-ec2-role`을 만든다. 우선 `AmazonSSMManagedInstanceCore`를 연결하고, 아래 정책 예시를 인라인 정책으로 추가한다.

- 정책 파일: [`iam/ec2-instance-policy.json`](./iam/ec2-instance-policy.json)
- `<AWS_ACCOUNT_ID>`를 실제 계정 ID로 치환한다.
- `<SSM_KMS_KEY_ARN>`을 Parameter Store에서 사용하는 KMS 키 ARN으로 치환한다.
- 치환 전 파일은 AWS 콘솔에 그대로 붙여 넣지 않는다.

운영 애플리케이션은 이 Role을 통해 AWS SDK 자격증명을 자동으로 얻는다. `AWS_ACCESS_KEY_ID`와 `AWS_SECRET_ACCESS_KEY`를 운영 `.env`에 넣지 않는다.

## 5. RDS PostgreSQL

RDS 생성값:

- 식별자: `familink-prod-db`
- 엔진: PostgreSQL 16
- 인스턴스 클래스: `db.t4g.micro`
- 배포: Single-AZ DB instance
- 스토리지: gp3, 20GB
- Public access: `No`
- 포트: `5432`
- VPC: `familink-prod-vpc`
- DB Subnet Group: 두 Private Subnet
- Security Group: `familink-prod-rds-sg`
- 저장 시 암호화: 활성화
- 백업 보존: 7일 권장

마스터 비밀번호는 생성 직후 비밀번호 관리자에 저장하고, 채팅·Git·스크린샷으로 공유하지 않는다. 생성 완료 후 Endpoint만 운영 설정에 사용한다.

## 6. Parameter Store 키

Parameter Store에서 `/familink/prod/` 계층으로 생성한다. `DB_PASSWORD`와 `DB_USERNAME`은 `SecureString`으로 만들고, 나머지는 용도에 따라 `String`으로 만든다.

| 파라미터 | 타입 | 값 또는 출처 |
|---|---|---|
| `/familink/prod/DB_HOST` | String | RDS Endpoint |
| `/familink/prod/DB_PORT` | String | `5432` |
| `/familink/prod/DB_NAME` | String | `s15p11b104` |
| `/familink/prod/DB_USERNAME` | SecureString | RDS 생성 시 입력한 사용자명 |
| `/familink/prod/DB_PASSWORD` | SecureString | RDS 생성 시 입력한 비밀번호 |
| `/familink/prod/S3_BUCKET` | String | `s15p11b104-media-580779787807-ap-northeast-2-an` |
| `/familink/prod/AWS_REGION` | String | `ap-northeast-2` |
| `/familink/prod/S3_PRESIGNED_URL_DURATION` | String | `10m` |
| `/familink/prod/S3_DOWNLOAD_URL_DURATION` | String | `30m` |

OpenAI, JWT, Firebase 같은 애플리케이션 비밀값은 실제 운영 프로필을 구성하는 199번에서 필요한 범위만 추가한다. 사용하지 않는 비밀값을 미리 만들거나 문서에 값을 적지 않는다.

## 7. 완료 검증

- EC2 상태가 `Running`이고 Elastic IP가 연결되어 있다.
- EC2의 IAM Role이 `familink-prod-ec2-role`이다.
- Systems Manager의 Managed nodes에서 EC2가 `Online`이다.
- Session Manager로 EC2 셸에 접속할 수 있다.
- RDS 상태가 `Available`이다.
- RDS Public access가 `No`이다.
- RDS Security Group의 5432 출처가 EC2 Security Group이다.
- Parameter Store에 `/familink/prod/` 키가 존재한다.
- S3 버킷은 기존처럼 모든 퍼블릭 액세스 차단 상태다.

검증에 필요한 리소스 ID와 RDS Endpoint는 로컬 배포 메모에만 기록한다. AWS Access Key, Secret Key, DB 비밀번호는 저장소에 기록하지 않는다.

## 공식 문서

- [VPC 생성](https://docs.aws.amazon.com/vpc/latest/userguide/create-vpc.html)
- [Route Table 생성과 Subnet 연결](https://docs.aws.amazon.com/vpc/latest/userguide/create-vpc-route-table.html)
- [EC2 IAM Role 연결](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/attach-iam-role.html)
- [Session Manager IAM Role](https://docs.aws.amazon.com/systems-manager/latest/userguide/getting-started-create-iam-instance-profile.html)
- [RDS DB 인스턴스 생성](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html)
- [Parameter Store SecureString 생성](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-create-console.html)
