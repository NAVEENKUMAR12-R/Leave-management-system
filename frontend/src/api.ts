import axios from 'axios';

// Access Vite env statically for bundler replacement; default directly to live Render backend
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'https://leave-management-api-9tat.onrender.com/api';

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
