/**
 * Dirección del backend. En desarrollo VITE_API_URL suele ser "localhost", que solo existe en la laptop:
 * si la página se abre desde otro dispositivo (p. ej. el celular que escaneó el QR por la IP de la red),
 * se reemplaza "localhost" por el mismo host desde el que se cargó la página. En producción
 * VITE_API_URL es el dominio real y no se modifica.
 */
const LOOPBACK = ['localhost', '127.0.0.1', '::1', '[::1]'];

export function resolveApiUrl(configured: string | undefined, pageHost: string): string {
  const url = (configured || 'http://localhost:3000').trim();
  try {
    const u = new URL(url);
    if (LOOPBACK.includes(u.hostname) && pageHost && !LOOPBACK.includes(pageHost)) {
      u.hostname = pageHost;
      return u.toString().replace(/\/$/, '');
    }
  } catch { /* URL inválida: se usa tal cual */ }
  return url;
}
