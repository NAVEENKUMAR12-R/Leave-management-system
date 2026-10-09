# Leave Management System - Frontend

React 19 + TypeScript + Vite + Tailwind/Modern CSS

---

## Environment Configuration

Create a `.env` file in `frontend/`:
```env
VITE_API_BASE_URL=http://localhost:8080/api
```

---

## Deployment to Vercel (Free)

The frontend is deployed on Vercel:

1. Import the repository `Leave-management-system` on [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
3. Add Environment Variable:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<YOUR_BACKEND_URL>/api` (e.g. `https://leave-management-backend.onrender.com/api`)
4. Click **Deploy**.

When the backend URL changes or is newly deployed, update `VITE_API_BASE_URL` in Vercel **Settings -> Environment Variables** and trigger a redeploy.
