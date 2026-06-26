import axios from 'axios';
import { getToken } from '../utils/auth';

function getApiBaseUrl() {
  const { protocol, hostname } = window.location;
  const configuredUrl = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();

  const isLocalHost = (value) => ['localhost', '127.0.0.1', '::1'].includes(value);
  const isPrivateLanHost = (value) => (
    /^10\./.test(value) ||
    /^192\.168\./.test(value) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value)
  );
  const withApiPath = (url) => {
    const cleanUrl = url.replace(/\/$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  };

  if (configuredUrl) {
    try {
      const configured = new URL(configuredUrl);
      const configuredPort = configured.port || '5000';

      if (isLocalHost(hostname)) {
        return withApiPath(`${protocol}//localhost:${configuredPort}`);
      }

      if (isPrivateLanHost(hostname) && isPrivateLanHost(configured.hostname)) {
        return withApiPath(`${protocol}//${hostname}:${configuredPort}`);
      }

      return withApiPath(configuredUrl);
    } catch {
      return withApiPath(configuredUrl);
    }
  }

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
