import { useState } from 'react';
import { Copy, Check, ExternalLink, Share2 } from 'lucide-react';
import { usePlan } from '../../features/saas/PlanContext';

/** Enlace público del catálogo de la empresa para compartir con los clientes. */
export const StoreLinkCard = () => {
  const { tenant } = usePlan();
  const [copied, setCopied] = useState(false);
  if (!tenant?.slug) return null;

  const url = `${window.location.origin}/t/${tenant.slug}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin portapapeles */ }
  };
  const share = () => {
    const text = `Mira el catálogo de ${tenant.name}: ${url}`;
    if (navigator.share) navigator.share({ title: tenant.name, text, url }).catch(() => {});
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1.5px solid #d1d5db', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: '0.84rem', fontFamily: 'inherit', color: '#182D2A', textDecoration: 'none' };

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 14px rgba(0,0,0,0.06)', marginBottom: 20 }}>
      <div style={{ fontWeight: 700, color: '#182D2A', marginBottom: 4 }}>Tu tienda en línea</div>
      <p style={{ margin: '0 0 12px', color: '#6b7280', fontSize: '0.86rem' }}>Comparte este enlace con tus clientes para que vean tu catálogo, reserven y compren.</p>
      <code style={{ display: 'block', padding: '10px 12px', background: '#F5F2EB', borderRadius: 8, fontSize: '0.86rem', wordBreak: 'break-all', marginBottom: 12 }}>{url}</code>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={btn} onClick={copy}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? 'Copiado' : 'Copiar'}</button>
        <a style={btn} href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Abrir</a>
        <button style={btn} onClick={share}><Share2 size={15} />Compartir</button>
      </div>
    </div>
  );
};
