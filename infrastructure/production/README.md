# Familink 운영 실행 환경

이 디렉터리는 EC2 한 대에서 Nginx, Spring Boot, Redis를 실행하기 위한 운영 기본 구성을 담습니다. PostgreSQL은 EC2에 설치하지 않고 AWS RDS를 사용하며, 미디어 파일은 기존 비공개 S3 버킷에 직접 업로드합니다.

## 구성

- `backend`: Java 21 Spring Boot 컨테이너. 외부 포트를 열지 않고 Compose 네트워크에서만 `8080`으로 접근합니다.
- `redis`: Redis 7.4 컨테이너. AOF와 named volume을 사용하며 외부 포트를 열지 않습니다.
- `nginx`: 외부 `80`, `443` 포트를 받아 backend로 전달합니다. `api.familink360.com`은 HTTP 요청을 HTTPS로 전환하고 Certbot 인증서를 사용합니다.
- RDS: `DB_HOST`에 지정한 Private Subnet의 PostgreSQL 인스턴스입니다.

## 시작 전 AWS 작업

EC2에 다음을 먼저 준비합니다.

1. EC2와 RDS가 같은 VPC에 있고 RDS 보안 그룹이 EC2 보안 그룹의 `5432`만 허용하는지 확인합니다.
2. EC2 보안 그룹은 `80`, `443`만 인터넷에 공개합니다. `8080`, `6379`, `5432`는 공개하지 않습니다.
3. EC2에 S3 `post-media/*`, ECR Pull, SSM, Parameter Store, CloudWatch 최소 권한 IAM Role을 연결합니다. 예시는 `infrastructure/aws-foundation/iam/ec2-instance-policy.json`입니다.
4. AWS Access Key를 운영 `.env`에 넣지 않습니다. SDK가 EC2 IAM Role의 기본 자격증명을 사용합니다.

## 환경변수

운영 서버에서 예시 파일을 복사한 뒤 `replace-with-*` 값을 실제 RDS·보안 값으로 바꿉니다. `.env`는 Git에 커밋하지 않습니다.

```text
cp infrastructure/production/.env.example infrastructure/production/.env
```

Windows PowerShell에서는 다음과 같이 복사할 수 있습니다.

```powershell
Copy-Item infrastructure/production/.env.example infrastructure/production/.env
```

`DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`는 비워 두거나 예시 값을 그대로 사용하면 안 됩니다. S3 버킷 이름은 현재 버킷 이름을 유지합니다.

Firebase 서비스 계정 JSON은 저장소 밖의 운영 서버 경로에 두고
`FIREBASE_CREDENTIALS_FILE`에 그 절대 경로를 지정합니다. Compose는 파일을
읽기 전용으로 마운트하고 컨테이너의 `GOOGLE_APPLICATION_CREDENTIALS`로만
전달합니다. `PUSH_ENABLED=true`인데 파일이 없거나 올바르지 않으면 백엔드는
의도적으로 시작하지 않습니다. `PUSH_ENABLED=false`일 때는
`FIREBASE_CREDENTIALS_FILE`을 생략할 수 있으며, 백엔드는 푸시만 건너뜁니다.

## 실행

저장소 루트에서 Compose 파일의 경로를 지정합니다.

```text
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml config
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml build backend
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml up -d
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml ps
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml logs -f backend
```

첫 실행은 Dockerfile로 이미지를 빌드하므로 Gradle과 애플리케이션 의존성을 다운로드합니다. Dockerfile의 운영 런타임에는 영상 검증에 필요한 FFmpeg·FFprobe와 컨테이너 health check에 필요한 curl이 포함됩니다.

```text
sh infrastructure/production/scripts/health-check.sh https://api.familink360.com/actuator/health
```

정상이라면 Spring Boot의 `{"status":"UP"}` 응답이 출력됩니다. Flyway는 Jenkins가 별도로 실행하지 않고 Spring Boot 시작 과정에서 한 번 실행됩니다. `ddl-auto`는 `validate`이므로 운영 DB 스키마를 자동 변경하지 않습니다.

## 설정 기준

- Spring profile: `prod`
- JVM: `-Xms512m -Xmx1280m -XX:MaxMetaspaceSize=256m -XX:+UseG1GC`
- Backend: `mem_limit=2g`, `cpus=1.5`
- HikariCP: 최대 8, 최소 유휴 2, 연결 대기 30초
- Redis: AOF, `maxmemory 384mb`, `noeviction`, 데이터 volume 유지
- 영상·이미지 업로드: Nginx를 거치지 않고 S3 presigned URL 사용

`BACKEND_IMAGE`는 ECR의 전체 Commit SHA 이미지 주소를 사용합니다. `latest`만으로 배포하지 않으므로 현재 배포 버전을 확인하고 직전 이미지로 되돌릴 수 있습니다. Compose의 `build` 설정은 최초 수동 구성 확인용이며 Jenkins 운영 배포는 `--no-build`로 ECR 이미지만 사용합니다.

## Jenkins 자동 배포

`main` 병합 후 Jenkins가 ECR에 Commit SHA 이미지를 Push하고 SSM으로 운영 EC2의 배포 스크립트를 실행합니다. 운영 EC2의 기본 저장소 경로는 `/home/ssm-user/S15P11B104`입니다.

```text
APP_ROOT=/home/ssm-user/S15P11B104 bash /home/ssm-user/S15P11B104/infrastructure/production/scripts/deploy.sh <40자리-Git-Commit-SHA>
```

이 명령은 다음 작업을 순서대로 수행합니다.

1. EC2 IAM Role로 ECR에 로그인하고 SHA 이미지를 Pull합니다.
2. 운영 `.env`, Nginx, Redis는 유지하고 backend 컨테이너만 교체합니다.
3. 컨테이너 내부 Actuator와 외부 HTTPS health check를 확인합니다.
4. 실패하면 교체 전 이미지로 자동 rollback합니다.
5. 배포 결과는 `.deployment/current-image`에 기록합니다. 이 디렉터리는 Git에 포함되지 않습니다.

Jenkins·ECR·SSM·Mattermost의 최초 설정 방법은 `infrastructure/ci/README.md`를 따릅니다.

## 점검 및 종료

```text
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml ps
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml logs --tail=200 nginx backend redis
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml down
```

`down`은 컨테이너만 중지하고 Redis named volume은 삭제하지 않습니다. 데이터까지 지우는 `down -v`는 운영에서 사용하지 않습니다.

도메인, Certbot HTTPS, CloudWatch Agent와 핵심 알람은 200번 작업에서 적용되었습니다. 배포 후에는 HTTPS health check와 CloudWatch `/familink/prod/deploy` 로그를 함께 확인합니다.
