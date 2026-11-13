import { resolveApiUrl } from './resolveApiUrl';

/** Dirección del backend (ver resolveApiUrl.ts). */
export const API_URL = resolveApiUrl(import.meta.env.VITE_API_URL, typeof window !== 'undefined' ? window.location.hostname : '');
