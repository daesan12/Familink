def sendMattermost(String event, String color, String detail = '') {
    try {
        withCredentials([
            string(
                credentialsId: 'familink-mattermost-webhook',
                variable: 'MATTERMOST_ENDPOINT'
            )
        ]) {
            mattermostSend(
                endpoint: env.MATTERMOST_ENDPOINT,
                failOnError: false,
                color: color,
                message: """### ${event}

**🤖🚀 Familink CI/CD 알림 🚀🤖**

- **🌿 브랜치**: `${env.BRANCH_NAME ?: '알 수 없음'}`
- **🧾 커밋**: `${env.GIT_COMMIT ?: '알 수 없음'}`
- **🏗️ 빌드**: [Jenkins #${env.BUILD_NUMBER}](${env.BUILD_URL})
${detail ? "\n> **상세**: ${detail}" : ''}

_📣 배포 상태는 Jenkins 결과를 기준으로 확인해 주세요. 🐳☕_"""
            )
        }
    } catch (Exception ignored) {
        echo 'Mattermost notification could not be sent; the pipeline result is unchanged.'
    }
}

pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        timeout(time: 40, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        AWS_DEFAULT_REGION = 'ap-northeast-2'
        ECR_REPOSITORY = 'familink-backend'
        PRODUCTION_APP_DIR = '/home/ssm-user/S15P11B104'
        DEPLOY_TARGET = ''
        DEPLOY_EVENT_REPORTED = 'false'
    }

    stages {
        stage('Test') {
            steps {
                sh 'bash backend/gradlew -p backend test --no-daemon'
            }
        }

        stage('BootJar') {
            steps {
                sh 'bash backend/gradlew -p backend bootJar --no-daemon'
            }
        }

        stage('Build Docker image') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'familink-aws-ecr',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    script {
                        env.IMAGE_TAG = sh(
                            script: 'git rev-parse HEAD',
                            returnStdout: true
                        ).trim()
                        env.AWS_ACCOUNT_ID = sh(
                            script: 'aws sts get-caller-identity --query Account --output text',
                            returnStdout: true
                        ).trim()
                        env.ECR_REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${env.AWS_DEFAULT_REGION}.amazonaws.com"
                        env.IMAGE_URI = "${env.ECR_REGISTRY}/${env.ECR_REPOSITORY}:${env.IMAGE_TAG}"
                        sh 'docker build --pull --tag "$IMAGE_URI" backend'
                    }
                }
            }
        }

        stage('Push ECR image') {
            when {
                anyOf {
                    branch 'develop'
                    branch 'main'
                }
            }
            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'familink-aws-ecr',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    )
                ]) {
                    sh '''#!/usr/bin/env bash
                        set -Eeuo pipefail
                        aws ecr get-login-password --region "$AWS_DEFAULT_REGION" \
                          | docker login --username AWS --password-stdin "$ECR_REGISTRY"
                        docker push "$IMAGE_URI"
                    '''
                }
            }
        }

        stage('Deploy staging') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    env.DEPLOY_TARGET = 'staging'
                    sendMattermost('🚀🛫📦 스테이징 배포 출발합니다 기대하세요 😎', '#439FE0', "이미지 `${env.IMAGE_TAG}` 📦🐳")
                }
                withCredentials([
                    file(
                        credentialsId: 'familink-staging-env',
                        variable: 'STAGING_ENV_FILE'
                    )
                ]) {
                    sh '''#!/usr/bin/env bash
                        set -Eeuo pipefail
                        install -m 600 "$STAGING_ENV_FILE" infrastructure/staging/.env
                        export STAGING_BACKEND_IMAGE="$IMAGE_URI"
                        docker compose \
                          --env-file infrastructure/staging/.env \
                          -f infrastructure/staging/compose.staging.yml \
                          pull backend
                        docker compose \
                          --env-file infrastructure/staging/.env \
                          -f infrastructure/staging/compose.staging.yml \
                          up -d --no-build
                        sh infrastructure/production/scripts/health-check.sh \
                          http://127.0.0.1:18080/actuator/health 18 5
                    '''
                }
                script {
                    env.DEPLOY_EVENT_REPORTED = 'true'
                    sendMattermost('🎉✅🥳🐳 스테이징 배포 성공 굿굿 🦸✨', 'good', "이미지 `${env.IMAGE_TAG}` 📦✨")
                }
            }
        }

        stage('Deploy production') {
            when {
                branch 'main'
            }
            steps {
                script {
                    env.DEPLOY_TARGET = 'production'
                    sendMattermost('🚀🔥🛫 운영 배포 시작합니다 기대가 됩니다 ㅎㅎ 😎🍿', '#439FE0', "이미지 `${env.IMAGE_TAG}` 📦🐳")
                }
                withCredentials([
                    usernamePassword(
                        credentialsId: 'familink-aws-ecr',
                        usernameVariable: 'AWS_ACCESS_KEY_ID',
                        passwordVariable: 'AWS_SECRET_ACCESS_KEY'
                    ),
                    string(
                        credentialsId: 'familink-prod-instance-id',
                        variable: 'PRODUCTION_INSTANCE_ID'
                    )
                ]) {
                    script {
                        env.SSM_COMMAND_ID = sh(
                            script: '''#!/usr/bin/env bash
                                set -Eeuo pipefail
                                aws ssm send-command \
                                  --region "$AWS_DEFAULT_REGION" \
                                  --instance-ids "$PRODUCTION_INSTANCE_ID" \
                                  --document-name AWS-RunShellScript \
                                  --comment "Familink production deploy $IMAGE_TAG" \
                                  --parameters "commands=APP_ROOT=$PRODUCTION_APP_DIR bash $PRODUCTION_APP_DIR/infrastructure/production/scripts/deploy.sh $IMAGE_TAG" \
                                  --cloud-watch-output-config "CloudWatchOutputEnabled=true,CloudWatchLogGroupName=/familink/prod/deploy" \
                                  --query Command.CommandId \
                                  --output text
                            ''',
                            returnStdout: true
                        ).trim()

                        int deployResult = sh(
                            script: 'bash infrastructure/ci/wait-for-ssm-command.sh "$AWS_DEFAULT_REGION" "$SSM_COMMAND_ID" "$PRODUCTION_INSTANCE_ID"',
                            returnStatus: true
                        )

                        if (deployResult == 42) {
                            env.DEPLOY_EVENT_REPORTED = 'true'
                            sendMattermost('⚠️🩺😵‍💫 헬스체크 실패 ㅠㅠㅠㅠ · 🛟🔙 롤백 성공 😮‍💨', 'warning', "복구 이미지로 되돌렸습니다. 대상 이미지 `${env.IMAGE_TAG}` 🐳")
                            error('Production deployment failed and the previous image was restored.')
                        }
                        if (deployResult == 43) {
                            env.DEPLOY_EVENT_REPORTED = 'true'
                            sendMattermost('🚨💀☠️🪦 운영 배포·롤백 모두 실패 죽으러갑니다 💩🔥🤡', 'danger', "즉시 로그와 EC2 상태를 확인해 주세요. 이미지 `${env.IMAGE_TAG}` 😭")
                            error('Production deployment failed and rollback also failed.')
                        }
                        if (deployResult != 0) {
                            env.DEPLOY_EVENT_REPORTED = 'true'
                            sendMattermost('🚨💩🤦 운영 배포 실패 망했습니다 😵‍💫', 'danger', "SSM 배포가 실패했습니다. 이미지 `${env.IMAGE_TAG}` 🐒")
                            error("Production SSM deployment failed with exit code ${deployResult}.")
                        }
                    }
                }
                script {
                    env.DEPLOY_EVENT_REPORTED = 'true'
                    sendMattermost('🎉✅🥳🐳 운영 배포 성공 앙 너무 좋아요~ ^^ 🦸✨', 'good', "이미지 `${env.IMAGE_TAG}`가 정상 반영되었습니다. 🚀📦")
                }
            }
        }
    }

    post {
        always {
            sh 'rm -f infrastructure/staging/.env || true'
        }
        failure {
            script {
                if (env.DEPLOY_EVENT_REPORTED != 'true') {
                    String event = env.DEPLOY_TARGET
                        ? "🚨💩 ${env.DEPLOY_TARGET} 배포 또는 헬스체크 실패 화난다!!!!!!!!!! 🤬🔥"
                        : '🧪💥🤦‍♂️ 배포 전 파이프라인 실패 똥망 💩🤡'
                    sendMattermost(event, 'danger', "결과: `${currentBuild.currentResult}` 💥📉")
                }
            }
        }
    }
}
