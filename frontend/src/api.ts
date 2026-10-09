import axios from 'axios';

// Safely access Vite environment variables with fallback
export const API_BASE_URL: string =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_API_BASE_URL ||
  'http://localhost:8080/api';

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
