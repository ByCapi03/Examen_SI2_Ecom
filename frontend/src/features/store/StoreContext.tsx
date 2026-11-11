import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { CartProvider } from '../cart/CartContext';

export interface StoreBranch { name: string; address: string; phone: string; city: string | null }
export interface StoreConfig {
  published: boolean; tagline: string; heroTitle: string; heroText: string; accentColor: string; logoUrl: string;
  whatsapp: string; instagram: string; showFeatured: boolean; showBranches: boolean; showTryOn: boolean;
}
export const DEFAULT_STORE_CONFIG: StoreConfig = {
  published: true, tagline: '', heroTitle: '', heroText: '', accentColor: '#C9904A', logoUrl: '',
  whatsapp: '', instagram: '', showFeatured: true, showBranches: true, showTryOn: true,
};
export interface StoreInfo { name: string; slug: string; branches: StoreBranch[]; config: StoreConfig }

interface Ctx {
  slug: string;
  store: StoreInfo | null;
  status: 'loading' | 'ready' | 'notfound' | 'offline' | 'suspended';
  /** Empresa de la sesión iniciada (si no coincide con la tienda de la URL, la API devolvería datos de otra). */
  sessionStore: { slug: string; name: string } | null;
  mismatch: boolean;
  /** Ruta dentro de la tienda: path('/catalog') -> /t/<slug>/catalog */
  path: (p?: string) => string;
}

const StoreContext = createContext<Ctx | null>(null);

/**
 * Tienda pública de una empresa. La empresa sale de la URL (/t/:slug); en las pantallas de la cuenta
 * del cliente (/account) sale de la empresa de su sesión.
 */
export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const { slug: slugParam } = useParams();
  const { isAuthenticated } = useAuth();
  const [sessionStore, setSessionStore] = useState<{ slug: string; name: string } | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(!isAuthenticated);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [status, setStatus] = useState<Ctx['status']>('loading');

  useEffect(() => {
    if (!isAuthenticated) { setSessionStore(null); setSessionLoaded(true); return; }
    let stale = false;
    setSessionLoaded(false);
    api.get('/saas/tenants/me')
      .then((r) => { if (!stale) setSessionStore({ slug: r.data.slug, name: r.data.name }); })
      .catch(() => { if (!stale) setSessionStore(null); })
      .finally(() => { if (!stale) setSessionLoaded(true); });
    return () => { stale = true; };
  }, [isAuthenticated]);

  const slug = (slugParam ?? sessionStore?.slug ?? '').toLowerCase();

  useEffect(() => {
    if (!slug) { if (sessionLoaded) setStatus('notfound'); return; }
    let stale = false;
    setStatus('loading');
    api.get(`/saas/tenants/by-slug/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (stale) return;
        setStore(r.data); setStatus('ready');
        try { localStorage.setItem(`store_info:${slug}`, JSON.stringify(r.data)); } catch { /* sin almacenamiento */ }
      })
      .catch((err) => {
        if (stale) return;
        // 404 = la tienda no existe. Sin respuesta (offline / red caída) = usar la última copia guardada.
        if (err?.response?.status === 404) { setStore(null); setStatus('notfound'); return; }
        if (err?.response?.data?.code === 'TENANT_SUSPENDED') { setStore(null); setStatus('suspended'); return; }
        let cached: StoreInfo | null = null;
        try { cached = JSON.parse(localStorage.getItem(`store_info:${slug}`) || 'null'); } catch { /* ignorar */ }
        if (cached) { setStore(cached); setStatus('ready'); } else { setStore(null); setStatus('offline'); }
      });
    return () => { stale = true; };
  }, [slug, sessionLoaded]);

  const value = useMemo<Ctx>(() => ({
    slug, store, status, sessionStore,
    mismatch: !!slugParam && !!sessionStore && sessionStore.slug !== slug,
    path: (p = '/') => `/t/${slug}${p === '/' ? '' : p}`,
  }), [slug, store, status, sessionStore, slugParam]);

  return (
    <StoreContext.Provider value={value}>
      <CartProvider key={slug} storageKey={`boutique_cart:${slug}`}>{children}</CartProvider>
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
};
