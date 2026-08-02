FROM gradle:8.14.3-jdk21 AS build

WORKDIR /workspace
COPY . .
RUN sh ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ffmpeg \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /workspace/build/libs/*.jar /app/backend.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/backend.jar"]
