import axios from 'axios';
function getApiBaseUrl() {
  // In development, Vite proxies /api to the backend so browser CORS is avoided entirely.
  if (import.meta.env.DEV) return '/api';

  const configuredUrl = String(import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();
  const withApiPath = (url) => {
    const cleanUrl = url.replace(/\/$/, '');
    return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
  };

  if (configuredUrl) {
    return withApiPath(configuredUrl);
  }

  return '/api';
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 8000,
  withCredentials: true
});

const CACHE_TTL = 30 * 1000;
const responseCache = new Map();
const pendingRequests = new Map();
let refreshSessionRequest = null;

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
  const method = String(config.method || 'get').toLowerCase();

  if (method !== 'get') clearApiCache();

  if (method === 'get' && config.cache === true) {
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

  if (!['get', 'head', 'options'].includes(method)) {
    const csrfToken = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('ztech_csrf='))
      ?.split('=')
      .slice(1)
      .join('=');
    if (csrfToken) config.headers['X-CSRF-Token'] = decodeURIComponent(csrfToken);
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
  async (error) => {
    const requestUrl = String(error.config?.url || '');
    const isLoginRequest = requestUrl.includes('/auth/login');
    const isRefreshRequest = requestUrl.includes('/auth/refresh');

    if (error.response?.status === 401 && !isLoginRequest && !isRefreshRequest && !error.config?.__sessionRetried) {
      try {
        error.config.__sessionRetried = true;
        if (!refreshSessionRequest) {
          refreshSessionRequest = api.post('/auth/refresh')
            .finally(() => { refreshSessionRequest = null; });
        }
        await refreshSessionRequest;
        return api.request(error.config);
      } catch {
        // The refresh interceptor below clears the local user marker.
      }
    }

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
