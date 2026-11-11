import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.2:3000';

/** Aviso de acceso (empresa suspendida / suscripción vencida): lo registra la app para mostrar un mensaje. */
type AccessHandler = (kind: 'SUSPENDED' | 'EXPIRED') => void;
let accessHandler: AccessHandler | null = null;
export const setAccessHandler = (fn: AccessHandler | null) => { accessHandler = fn; };

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('userToken');

      console.log(`[Axios Request] URL: ${config.url}`);
      if (token) {
        console.log(`[Axios Request] Token present: Yes`);
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        console.log(`[Axios Request] Token present: No`);
      }
    } catch (e) {
      console.error('Error reading token from SecureStore', e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = String(error.response?.data?.message ?? '');
    if (status === 403 && (/suspendid/i.test(message) || error.response?.data?.code === 'TENANT_SUSPENDED')) accessHandler?.('SUSPENDED');
    else if (status === 402) accessHandler?.('EXPIRED');
    console.log({
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);
