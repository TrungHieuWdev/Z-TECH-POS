import axios from 'axios';
import { getToken } from '../utils/auth';

function getApiBaseUrl() {
  // In development, Vite proxies /api to the backend so browser CORS is avoided entirely.
  if (import.meta.env.DEV) return '/api';

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

const CACHE_TTL = 15 * 60 * 1000;
const responseCache = new Map();
const pendingRequests = new Map();

function stableParams(params) {
  if (!params || typeof params !== 'object') return String(params || '');
  return JSON.stringify(Object.keys(params).sort().map((key) => [key, params[key]]));
}

function getRequestKey(config) {
  return `${config.baseURL || ''}${config.url || ''}?${stableParams(config.params)}`;
}

export function clearApiCache() {
  responseCache.clear();
}

api.interceptors.request.use((config) => {
  const token = getToken();
  const method = String(config.method || 'get').toLowerCase();

  if (method !== 'get') clearApiCache();

  if (method === 'get' && config.cache !== false) {
    const requestKey = getRequestKey(config);
    const cached = responseCache.get(requestKey);

    if (cached && Date.now() - cached.savedAt < CACHE_TTL) {
      config.__servedFromCache = true;
      config.adapter = async () => ({
        data: cached.data,
        status: cached.status,
        statusText: cached.statusText,
        headers: cached.headers,
        config,
        request: null
      });
    } else {
      if (cached) responseCache.delete(requestKey);
      config.__cacheKey = requestKey;

      const pending = pendingRequests.get(requestKey);
      if (pending) {
        config.__joinedPendingRequest = true;
        config.adapter = async () => {
          const response = await pending;
          return { ...response, config };
        };
      } else {
        const defaultAdapter = axios.getAdapter(config.adapter || api.defaults.adapter);
        config.adapter = (adapterConfig) => {
          const request = defaultAdapter(adapterConfig);
          pendingRequests.set(requestKey, request);
          const clearPending = () => {
            if (pendingRequests.get(requestKey) === request) pendingRequests.delete(requestKey);
          };
          request.then(clearPending, clearPending);
          return request;
        };
      }
    }
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (response.config?.__cacheKey && !response.config.__servedFromCache) {
      responseCache.set(response.config.__cacheKey, {
        savedAt: Date.now(),
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    }
    return response;
  },
  (error) => {
    const requestUrl = String(error.config?.url || '');
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest) {
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
