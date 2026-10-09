# Multi-stage build for Spring Boot application
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder
WORKDIR /app

# Cache dependencies
COPY backend/pom.xml ./pom.xml
RUN mvn dependency:go-offline -B

# Build application jar
COPY backend/src ./src
RUN mvn clean package -DskipTests

# Minimal runtime image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Copy executable jar from builder stage
COPY --from=builder /app/target/*.jar app.jar

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["sh", "-c", "java -Dserver.port=${PORT:-8080} -jar app.jar"]
