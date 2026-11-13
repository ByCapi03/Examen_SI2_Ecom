import { originOf, resolvePublicWebUrl } from './public-url';

describe('resolvePublicWebUrl', () => {
  it('QR_PUBLIC_WEB_URL explícita manda sobre todo', () => {
    expect(resolvePublicWebUrl({ explicit: 'https://tienda.com/', frontendUrl: 'https://otro.com', origin: 'http://192.168.0.11:5173' })).toBe('https://tienda.com');
  });

  it('en producción FRONTEND_URL real manda sobre el origen de la petición', () => {
    expect(resolvePublicWebUrl({ frontendUrl: 'https://app.dressed.com', origin: 'https://evil.example' })).toBe('https://app.dressed.com');
  });

  it('en desarrollo, con FRONTEND_URL en localhost, usa la IP desde la que se abrió el POS', () => {
    expect(resolvePublicWebUrl({ frontendUrl: 'http://localhost:5173', origin: 'http://192.168.0.11:5173' })).toBe('http://192.168.0.11:5173');
  });

  it('si todo es localhost, devuelve localhost (solo sirve en la laptop)', () => {
    expect(resolvePublicWebUrl({ frontendUrl: 'http://localhost:5173', origin: 'http://localhost:5173' })).toBe('http://localhost:5173');
    expect(resolvePublicWebUrl({})).toBe('http://localhost:5173');
  });
});

describe('originOf', () => {
  it('usa Origin y, si falta, el origen del Referer', () => {
    expect(originOf({ origin: 'http://192.168.0.11:5173' })).toBe('http://192.168.0.11:5173');
    expect(originOf({ referer: 'http://192.168.0.11:5173/dashboard/pos?x=1' })).toBe('http://192.168.0.11:5173');
  });
  it('ignora valores inválidos o de otros esquemas', () => {
    expect(originOf({ origin: 'null' })).toBeUndefined();
    expect(originOf({ origin: 'javascript:alert(1)' })).toBeUndefined();
    expect(originOf({})).toBeUndefined();
  });
});
