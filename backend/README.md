# Backend setup

## Neon PostgreSQL

Set these environment variables before starting Spring Boot:

```text
DATABASE_URL=jdbc:postgresql://ep-snowy-feather-ay16ej9r-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channelBinding=require
DATABASE_USERNAME=neondb_owner
DATABASE_PASSWORD=<your Neon password>
```

The pooled Neon endpoint is used for the application runtime. `.env.example` is only a template; Spring Boot does not load it automatically. The ignored `backend/.env` file is loaded automatically for local development. Do not commit the real password. Neon credentials are required because this project has no local PostgreSQL fallback.

On Windows PowerShell, set them for the current terminal with:

```powershell
$env:DATABASE_URL = "jdbc:postgresql://ep-snowy-feather-ay16ej9r-pooler.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&channelBinding=require"
$env:DATABASE_USERNAME = "neondb_owner"
$env:DATABASE_PASSWORD = "<your Neon password>"
mvn spring-boot:run
```