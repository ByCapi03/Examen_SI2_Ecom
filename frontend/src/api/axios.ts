import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { cacheGet, cacheSet } from '../offline/db';
import { readBranchScope } from '../features/branches/branchScope';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000'
});

/**
 * Lecturas que se guardan en IndexedDB para seguir operando sin conexión.
 * Si la red falla, se responde con la última copia local (marcada fromCache).
 */
const OFFLINE_CACHEABLE = [
  '/pos/products',
  '/pos/clients',
  '/cash-sessions/current',
  '/store/products',
  '/store/availability',
  '/branches',
  '/products',
  '/inventory',
  '/reservations/my',
  '/sales/my',
  '/saas/tenants/me',
];

const cacheKey = (config: InternalAxiosRequestConfig) => {
  const params = config.params ? `?${new URLSearchParams(config.params).toString()}` : '';
  return `GET ${config.url}${params}`;
};

const isCacheable = (config?: InternalAxiosRequestConfig) =>
  !!config && (config.method ?? 'get').toLowerCase() === 'get' &&
  OFFLINE_CACHEABLE.some((p) => (config.url ?? '').startsWith(p));

/** Lecturas que respetan el filtro `branchId` cuando el ADMIN está dentro de una sucursal. */
const BRANCH_SCOPED_GET = ['/sales', '/inventory', '/reservations', '/cash-sessions', '/users', '/dashboard/metrics', '/reports/'];
const BRANCH_SCOPE_EXCLUDED = ['/sales/my', '/reservations/my', '/cash-sessions/current'];

const isAdminUser = () => {
  try { return !!JSON.parse(localStorage.getItem('user') || 'null')?.roles?.includes('ADMIN'); } catch { return false; }
};

api.interceptors.request.use((config) => {
  const url = config.url ?? '';
  if ((config.method ?? 'get').toLowerCase() === 'get'
    && BRANCH_SCOPED_GET.some((p) => url.startsWith(p))
    && !BRANCH_SCOPE_EXCLUDED.some((p) => url.startsWith(p))
    && !config.params?.branchId && isAdminUser()) {
    const scope = readBranchScope();
    if (scope) config.params = { ...(config.params ?? {}), branchId: scope.id };
  }
  return config;
});

// Interceptor para inyectar el token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => {
    if (isCacheable(response.config)) void cacheSet(cacheKey(response.config), response.data);
    return response;
  },
  async (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    // Sin conexión: servir la última copia local si existe
    if (!error.response && isCacheable(error.config)) {
      const cached = await cacheGet(cacheKey(error.config));
      if (cached) {
        const offlineResponse: AxiosResponse & { fromCache?: boolean; savedAt?: string } = {
          data: cached.data,
          status: 200,
          statusText: 'OK (offline cache)',
          headers: {},
          config: error.config,
          fromCache: true,
          savedAt: cached.savedAt,
        };
        return offlineResponse;
      }
    }
    return Promise.reject(error);
  }
);
