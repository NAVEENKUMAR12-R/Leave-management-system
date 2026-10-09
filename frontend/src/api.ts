import axios from 'axios';

// Get base URL from environment or fallback to live Render backend
const rawUrl =
  import.meta.env.VITE_API_BASE_URL || 'https://leave-management-api-9tat.onrender.com/api';

// Bulletproof normalization: ensures the URL ALWAYS ends with /api even if omitted in Vercel settings
const cleanUrl = rawUrl.replace(/\/+$/, '');
export const API_BASE_URL: string = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
