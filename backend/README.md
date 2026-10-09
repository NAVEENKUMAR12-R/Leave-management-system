# Leave Management System - Backend

Spring Boot 3 + Java 17 + PostgreSQL (Supabase) + Spring Security (JWT)

---

## 1. Supabase PostgreSQL Configuration

The backend connects to PostgreSQL via JDBC. We recommend using **Supabase** (free tier includes 500MB PostgreSQL with SSL and connection pooling).

### Finding your Supabase Credentials:
1. Go to your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Project Settings** (gear icon) -> **Database**.
3. Scroll to **Connection string**:
   - Choose **JDBC** or **URI**.
   - Under **Mode**, select **Session** (Port `5432`). *Note: Free cloud hosts require IPv4, which Supabase's connection pooler (`pooler.supabase.com`) provides.*

### Required Environment Variables:
```env
DATABASE_URL=jdbc:postgresql://aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_USERNAME=postgres.<PROJECT_REF>
DATABASE_PASSWORD=<YOUR_SUPABASE_DB_PASSWORD>
PORT=8080
```

### Local Development:
Create a file named `backend/.env` (which is git-ignored) and add:
```env
DATABASE_URL=jdbc:postgresql://aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_USERNAME=postgres.<PROJECT_REF>
DATABASE_PASSWORD=your_password_here
PORT=8080
```

Run the backend:
```bash
mvn spring-boot:run
```

---

## 2. Free Backend Hosting (Render.com)

Render offers a generous **Free Web Service** tier that runs Docker containers for free:

1. Push your code to GitHub (branch: `feature` or `main`).
2. Go to [Render.com](https://render.com/) and click **New +** -> **Web Service**.
3. Connect your GitHub repository: `NAVEENKUMAR12-R/Leave-management-system`.
4. Configure the service:
   - **Root Directory**: `backend`
   - **Environment**: `Docker`
   - **Instance Type**: `Free`
5. In **Environment Variables**, add:
   - `DATABASE_URL`: `jdbc:postgresql://aws-0-<REGION>.pooler.supabase.com:5432/postgres?sslmode=require`
   - `DATABASE_USERNAME`: `postgres.<PROJECT_REF>`
   - `DATABASE_PASSWORD`: `<YOUR_SUPABASE_PASSWORD>`
6. Click **Deploy Web Service**.
7. Once deployed, Render will provide a live HTTPS URL (e.g. `https://leave-management-backend.onrender.com`).