import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { cacheGet, cacheSet } from '../offline/db';

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

// La empresa de la tienda pública sale de la URL (/t/<slug>). Con sesión iniciada manda el token.
api.interceptors.request.use((config) => {
  const m = typeof window !== 'undefined' ? window.location.pathname.match(/^\/t\/([a-z0-9-]+)/i) : null;
  if (m && config.headers && !config.headers['X-Tenant-Slug']) config.headers['X-Tenant-Slug'] = m[1].toLowerCase();
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
