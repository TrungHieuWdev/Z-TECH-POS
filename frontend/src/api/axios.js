import axios from 'axios';
import { getToken } from '../utils/auth';

function getApiBaseUrl() {
  const configuredUrl = String(import.meta.env.VITE_API_URL || '').trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000/api`;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 8000
});

api.interceptors.request.use((config) => {
  const token = getToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
