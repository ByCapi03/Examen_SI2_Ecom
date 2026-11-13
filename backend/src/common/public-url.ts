/**
 * Dirección pública del frontend que se graba en los códigos QR, los retornos de pago y los enlaces.
 * Función pura (sin dependencias) para poder probarla.
 *
 * Orden de prioridad:
 *  1. QR_PUBLIC_WEB_URL (valor explícito).
 *  2. FRONTEND_URL, si no apunta a localhost (al desplegar se configura con el dominio real y manda).
 *  3. El origen desde el que se hizo la petición (p. ej. http://192.168.0.11:5173 en desarrollo con el teléfono),
 *     si no es localhost: así el QR funciona sin tocar variables cuando el POS se abre por la IP de la red.
 *  4. FRONTEND_URL / origen / http://localhost:5173 (solo sirve en la propia laptop).
 */
const strip = (u?: string | null) => (u ?? '').trim().replace(/\/+$/, '');
const isLoopback = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(u);

export function resolvePublicWebUrl(opts: { explicit?: string; frontendUrl?: string; origin?: string }): string {
  const explicit = strip(opts.explicit);
  if (explicit) return explicit;
  const frontend = strip(opts.frontendUrl);
  const origin = strip(opts.origin);
  if (frontend && !isLoopback(frontend)) return frontend;
  if (origin && !isLoopback(origin)) return origin;
  return frontend || origin || 'http://localhost:5173';
}

/** Origen http(s) válido de una petición (cabecera Origin o, si falta, Referer); si no, undefined. */
export function originOf(headers: Record<string, any>): string | undefined {
  for (const raw of [headers?.origin, headers?.referer]) {
    if (!raw || typeof raw !== 'string') continue;
    try {
      const u = new URL(raw);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.origin;
    } catch { /* cabecera inválida */ }
  }
  return undefined;
}
