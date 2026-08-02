# Familink staging 실행 환경

staging은 Jenkins가 설치된 SSAFY EC2에서 실행합니다. 운영 RDS나 운영 Redis를 사용하지 않고 staging 전용 PostgreSQL·Redis 컨테이너를 함께 실행합니다.

`backend`만 `127.0.0.1:18080`에 연결되며 외부 네트워크에는 공개되지 않습니다. PostgreSQL `5432`와 Redis `6379`도 Compose 네트워크 안에서만 접근할 수 있습니다.

Jenkins의 `familink-staging-env` Secret file에는 `.env.example`의 Placeholder를 staging 전용 비밀값으로 바꾼 파일을 등록합니다. 실제 `.env`는 Jenkins가 배포할 때 권한 `600`으로 임시 생성하고 Pipeline 종료 시 삭제합니다.

수동 구성 확인은 저장소 루트에서 다음 명령으로 수행합니다.

```text
docker compose --env-file infrastructure/staging/.env -f infrastructure/staging/compose.staging.yml config
```

이 명령은 컨테이너를 실행하지 않고 환경변수와 Compose 문법이 올바른지 펼쳐서 보여줍니다.
