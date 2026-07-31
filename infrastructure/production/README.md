# Familink 운영 실행 환경

이 디렉터리는 EC2 한 대에서 Nginx, Spring Boot, Redis를 실행하기 위한 운영 기본 구성을 담습니다. PostgreSQL은 EC2에 설치하지 않고 AWS RDS를 사용하며, 미디어 파일은 기존 비공개 S3 버킷에 직접 업로드합니다.

## 구성

- `backend`: Java 21 Spring Boot 컨테이너. 외부 포트를 열지 않고 Compose 네트워크에서만 `8080`으로 접근합니다.
- `redis`: Redis 7.4 컨테이너. AOF와 named volume을 사용하며 외부 포트를 열지 않습니다.
- `nginx`: 외부 `80`, `443` 포트를 받아 backend로 전달합니다. 현재 티켓에서는 HTTP 리버스 프록시만 활성화하고, 인증서와 HTTPS 전환은 도메인·HTTPS 티켓에서 추가합니다.
- RDS: `DB_HOST`에 지정한 Private Subnet의 PostgreSQL 인스턴스입니다.

## 시작 전 AWS 작업

EC2에 다음을 먼저 준비합니다.

1. EC2와 RDS가 같은 VPC에 있고 RDS 보안 그룹이 EC2 보안 그룹의 `5432`만 허용하는지 확인합니다.
2. EC2 보안 그룹은 `80`, `443`만 인터넷에 공개합니다. `8080`, `6379`, `5432`는 공개하지 않습니다.
3. EC2에 S3 `post-media/*`, ECR Pull, SSM, Parameter Store, CloudWatch 최소 권한 IAM Role을 연결합니다.
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
sh infrastructure/production/scripts/health-check.sh http://127.0.0.1/actuator/health
```

정상이라면 Spring Boot의 `{"status":"UP"}` 응답이 출력됩니다. Flyway는 Jenkins가 별도로 실행하지 않고 Spring Boot 시작 과정에서 한 번 실행됩니다. `ddl-auto`는 `validate`이므로 운영 DB 스키마를 자동 변경하지 않습니다.

## 설정 기준

- Spring profile: `prod`
- JVM: `-Xms512m -Xmx1280m -XX:MaxMetaspaceSize=256m -XX:+UseG1GC`
- Backend: `mem_limit=2g`, `cpus=1.5`
- HikariCP: 최대 8, 최소 유휴 2, 연결 대기 30초
- Redis: AOF, `maxmemory 384mb`, `noeviction`, 데이터 volume 유지
- 영상·이미지 업로드: Nginx를 거치지 않고 S3 presigned URL 사용

`BACKEND_IMAGE`를 ECR 이미지 태그로 바꾸면 이후 CI/CD 티켓에서 빌드된 이미지를 재사용할 수 있습니다. 현재 Compose에도 `build` 설정이 있으므로 저장소를 받은 EC2에서 수동 빌드할 수 있습니다.

## 점검 및 종료

```text
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml ps
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml logs --tail=200 nginx backend redis
docker compose --env-file infrastructure/production/.env -f infrastructure/production/compose.prod.yml down
```

`down`은 컨테이너만 중지하고 Redis named volume은 삭제하지 않습니다. 데이터까지 지우는 `down -v`는 운영에서 사용하지 않습니다.

도메인, Certbot HTTPS, CloudWatch Agent와 알람은 다음 인프라 티켓의 범위입니다. 이 구성을 먼저 IP 기반 HTTP로 검증한 뒤 HTTPS를 활성화합니다.
