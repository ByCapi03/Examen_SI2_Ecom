import { useEffect, useState } from 'react';
import { ExternalLink, Save } from 'lucide-react';
import { api } from '../../api/axios';
import { DashStyles, PageHeader, Card } from '../../components/dashboard/ui';
import { StoreLinkCard } from '../../components/common/StoreLinkCard';
import { DEFAULT_STORE_CONFIG } from './StoreContext';
import type { StoreConfig } from './StoreContext';

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label style={{ display: 'block', marginBottom: 14 }}>
    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 5 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: '0.74rem', color: '#6b7280', marginTop: 4 }}>{hint}</div>}
  </label>
);

const Toggle = ({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', cursor: 'pointer' }}>
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
    <span><b style={{ fontSize: '0.88rem' }}>{label}</b><div style={{ fontSize: '0.76rem', color: '#6b7280' }}>{hint}</div></span>
  </label>
);

/** El administrador decide cómo se ve y qué muestra la web pública de su empresa. */
export const StoreBuilderPage = () => {
  const [slug, setSlug] = useState('');
  const [cfg, setCfg] = useState<StoreConfig>(DEFAULT_STORE_CONFIG);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    api.get('/saas/tenants/me').then((r) => { setSlug(r.data.slug); setCfg({ ...DEFAULT_STORE_CONFIG, ...r.data.storeConfig }); }).catch(() => {});
  }, []);

  const set = <K extends keyof StoreConfig>(k: K, v: StoreConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api.patch('/saas/tenants/me/store', cfg);
      setCfg({ ...DEFAULT_STORE_CONFIG, ...r.data.storeConfig });
      setRev((n) => n + 1);
      setMsg({ ok: true, text: 'Cambios guardados. Tu web ya los muestra.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.message || 'No se pudo guardar.' });
    } finally { setSaving(false); }
  };

  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', borderRadius: 8, border: '1.5px solid #d1d5db', fontSize: '0.9rem', fontFamily: 'inherit' };

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader
        title="Mi tienda web"
        subtitle="Personaliza la web pública de tu empresa y compártela con tus clientes"
        actions={slug ? <a className="dz-btn ghost" href={`/t/${slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Ver mi web</a> : undefined}
      />
      <StoreLinkCard />

      <div className="dz-grid dz-2-1">
        <div className="dz-grid">
          <Card title="Contenido de la portada">
            <Field label="Frase superior" hint="Ej. NUEVA COLECCIÓN 2026"><input style={input} maxLength={120} value={cfg.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
            <Field label="Título principal" hint="Si lo dejas vacío se usa el nombre de tu empresa."><input style={input} maxLength={80} value={cfg.heroTitle} onChange={(e) => set('heroTitle', e.target.value)} /></Field>
            <Field label="Descripción"><textarea style={{ ...input, minHeight: 70 }} maxLength={300} value={cfg.heroText} onChange={(e) => set('heroText', e.target.value)} /></Field>
            <Field label="Logo (URL de imagen)" hint="Enlace https a tu logo. Vacío = monograma con las iniciales."><input style={input} placeholder="https://…" value={cfg.logoUrl} onChange={(e) => set('logoUrl', e.target.value)} /></Field>
            <Field label="Color de acento">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="color" value={cfg.accentColor} onChange={(e) => set('accentColor', e.target.value)} style={{ width: 44, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
                <code>{cfg.accentColor}</code>
              </div>
            </Field>
          </Card>

          <Card title="Contacto">
            <Field label="WhatsApp" hint="Con código de país, ej. +59171234567"><input style={input} value={cfg.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
            <Field label="Instagram" hint="Usuario sin @"><input style={input} value={cfg.instagram} onChange={(e) => set('instagram', e.target.value)} /></Field>
          </Card>
        </div>

        <div className="dz-grid">
          <Card title="Qué mostrar">
            <Toggle label="Tienda publicada" hint="Si la desactivas, el enlace muestra «no disponible»." value={cfg.published} onChange={(v) => set('published', v)} />
            <Toggle label="Productos destacados" hint="Sección en la portada." value={cfg.showFeatured} onChange={(v) => set('showFeatured', v)} />
            <Toggle label="Sucursales en el pie" hint="Direcciones y teléfonos." value={cfg.showBranches} onChange={(v) => set('showBranches', v)} />
          </Card>
          <button className="dz-btn" onClick={save} disabled={saving} style={{ justifyContent: 'center' }}>
            <Save size={15} /> {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {msg && <div style={{ padding: 10, borderRadius: 8, fontSize: '0.85rem', background: msg.ok ? '#dcfce7' : '#fee2e2', color: msg.ok ? '#166534' : '#991b1b' }}>{msg.text}</div>}
        </div>
      </div>

      {slug && (
        <Card title="Vista previa" style={{ marginTop: 18 }}>
          <iframe key={rev} src={`/t/${slug}`} title="Vista previa de la tienda" style={{ width: '100%', height: 520, border: '1px solid #e5e7eb', borderRadius: 10 }} />
        </Card>
      )}
    </div>
  );
};
