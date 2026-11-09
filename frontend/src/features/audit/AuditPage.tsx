import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, ChevronRight, Download, KeyRound, PenLine, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../../config/SettingsContext';
import { DashStyles, PageHeader, PlanBadge, Card, KpiCard, Empty, Skeleton } from '../../components/dashboard/ui';

interface AuditItem {
  id: number; userId: number | null; userName: string | null; userEmail: string | null; userRoles: string | null;
  action: string; entity: string | null; entityId: string | null; summary: string; details: string | null;
  method: string; path: string; statusCode: number; ip: string | null; userAgent: string | null; createdAt: string;
}
interface Filters {
  actors: { id: number; name: string | null; email: string | null; events: number }[];
  entities: { key: string; label: string }[];
  actions: { key: string; label: string }[];
}
interface Summary { total: number; logins: number; failed: number; changes: number; users: number }

const ROLE_LABEL: Record<string, string> = { ADMIN: 'Administrador', ENCARGADO: 'Encargado', CAJERO: 'Cajero' };

const ACTION_STYLE: Record<string, { bg: string; fg: string }> = {
  LOGIN: { bg: 'rgba(22,163,74,0.14)', fg: '#15803D' },
  LOGIN_FAILED: { bg: 'rgba(220,38,38,0.12)', fg: '#B91C1C' },
  DENIED: { bg: 'rgba(217,119,6,0.16)', fg: '#B45309' },
  DELETE: { bg: 'rgba(220,38,38,0.12)', fg: '#B91C1C' },
  CREATE: { bg: 'rgba(201,144,74,0.2)', fg: 'var(--atemporal-gold)' },
};
const NEUTRAL = { bg: 'var(--chart-track)', fg: 'var(--atemporal-text)' };

const EMPTY = { from: '', to: '', userId: '', action: '', entity: '', q: '' };
const PAGE_SIZE = 25;

export const AuditPage = () => {
  const { user } = useAuth();
  const { locale } = useSettings();
  const isAdmin = !!user?.roles?.includes('ADMIN');

  const [filters, setFilters] = useState<Filters | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [f, setF] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [tick, setTick] = useState(0);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    (Object.keys(f) as (keyof typeof f)[]).forEach((k) => { if (f[k]) p[k] = f[k]; });
    return p;
  }, [f]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/audit-logs/filters').then((r) => setFilters(r.data)).catch(() => {});
    api.get('/audit-logs/summary').then((r) => setSummary(r.data)).catch(() => {});
  }, [isAdmin, tick]);

  // búsqueda con retardo para no consultar en cada tecla
  useEffect(() => {
    const t = setTimeout(() => { setF((cur) => (cur.q === search ? cur : { ...cur, q: search })); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    if (!isAdmin) return () => {};
    let stale = false;
    setLoading(true);
    setError(null);
    api.get('/audit-logs', { params: { ...params, page, limit: PAGE_SIZE } })
      .then((r) => { if (!stale) { setItems(r.data.items); setTotal(r.data.total); } })
      .catch((e) => { if (!stale) setError(e.response?.data?.message ?? 'No se pudo cargar la bitácora'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [isAdmin, params, page]);

  useEffect(() => load(), [load, tick]);

  const update = (patch: Partial<typeof EMPTY>) => { setF((cur) => ({ ...cur, ...patch })); setPage(1); setOpen(null); };
  const clear = () => { setF(EMPTY); setSearch(''); setPage(1); setOpen(null); };
  const hasFilters = Object.values(f).some(Boolean);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { data } = await api.get('/audit-logs/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bitacora-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo exportar la bitácora');
    } finally { setExporting(false); }
  };

  const entityLabel = (k: string | null) => (k ? filters?.entities.find((e) => e.key === k)?.label ?? k : '—');
  const actionLabel = (k: string) => filters?.actions.find((a) => a.key === k)?.label ?? k;
  const pretty = (raw: string | null) => { if (!raw) return null; try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; } };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  if (!isAdmin) {
    return <div className="dz-page"><DashStyles /><Empty text="Solo el administrador puede consultar la bitácora." /></div>;
  }

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader
        title="Bitácora"
        subtitle="Quién accedió y qué creó, modificó o eliminó en tu empresa. Los registros no se pueden editar ni borrar."
        badge={<PlanBadge />}
        actions={<>
          <button className="dz-btn ghost" onClick={() => setTick((n) => n + 1)}><RefreshCw size={15} /> Actualizar</button>
          <button className="dz-btn" onClick={() => void exportCsv()} disabled={exporting || total === 0}><Download size={15} /> {exporting ? 'Exportando…' : 'Exportar CSV'}</button>
        </>}
      />

      <div className="dz-grid dz-kpis" style={{ marginBottom: 18 }}>
        {!summary ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} h={110} />) : (
          <>
            <KpiCard label="Eventos hoy" value={String(summary.total)} icon={<Activity size={16} />} />
            <KpiCard label="Accesos hoy" value={String(summary.logins)} icon={<KeyRound size={16} />} />
            <KpiCard label="Cambios hoy" value={String(summary.changes)} icon={<PenLine size={16} />} tone="accent" />
            <KpiCard label="Fallidos o denegados" value={String(summary.failed)} icon={<ShieldAlert size={16} />} tone={summary.failed > 0 ? 'danger' : 'primary'} />
            <KpiCard label="Usuarios activos hoy" value={String(summary.users)} icon={<Users size={16} />} />
          </>
        )}
      </div>

      <div className="dz-card" style={{ padding: 14, marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Desde"><input type="date" className="dz-input" value={f.from} onChange={(e) => update({ from: e.target.value })} /></Field>
        <Field label="Hasta"><input type="date" className="dz-input" value={f.to} onChange={(e) => update({ to: e.target.value })} /></Field>
        <Field label="Usuario">
          <select className="dz-input" value={f.userId} onChange={(e) => update({ userId: e.target.value })}>
            <option value="">Todos</option>
            {filters?.actors.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.email} ({a.events})</option>)}
          </select>
        </Field>
        <Field label="Acción">
          <select className="dz-input" value={f.action} onChange={(e) => update({ action: e.target.value })}>
            <option value="">Todas</option>
            {filters?.actions.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </Field>
        <Field label="Módulo">
          <select className="dz-input" value={f.entity} onChange={(e) => update({ entity: e.target.value })}>
            <option value="">Todos</option>
            {filters?.entities.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
          </select>
        </Field>
        <Field label="Buscar"><input className="dz-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Usuario, detalle o ruta" style={{ minWidth: 190 }} /></Field>
        {hasFilters && <button className="dz-btn ghost" style={{ marginLeft: 'auto' }} onClick={clear}>Limpiar</button>}
      </div>

      {error && <div role="alert" style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', padding: 12, borderRadius: 12, marginBottom: 18 }}>{error}</div>}

      <Card title="Registro de actividad" subtitle={total ? `Mostrando ${from}–${to} de ${total} eventos` : undefined}>
        {loading ? <Skeleton h={260} /> : items.length === 0 ? (
          <Empty text={hasFilters ? 'Ningún evento coincide con los filtros' : 'Aún no hay actividad registrada. Aparecerá aquí cuando alguien acceda o cambie algo.'} />
        ) : (
          <div className="dz-scroll">
            <table className="dz-table">
              <thead><tr><th style={{ width: 28 }} /><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Módulo</th><th>Detalle</th><th>IP</th></tr></thead>
              <tbody>
                {items.map((it) => {
                  const st = ACTION_STYLE[it.action] ?? NEUTRAL;
                  const expanded = open === it.id;
                  const roles = (it.userRoles ?? '').split(',').filter(Boolean).map((r) => ROLE_LABEL[r] ?? r).join(', ');
                  return (
                    <FragmentRow key={it.id}>
                      <tr onClick={() => setOpen(expanded ? null : it.id)} style={{ cursor: 'pointer' }}>
                        <td>{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                        <td>{new Date(it.createdAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'medium' })}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{it.userName ?? it.userEmail ?? 'Sistema'}</div>
                          <div className="dz-sub" style={{ margin: 0 }}>{[roles, it.userName ? it.userEmail : null].filter(Boolean).join(' · ')}</div>
                        </td>
                        <td><span style={{ padding: '3px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800, background: st.bg, color: st.fg, whiteSpace: 'nowrap' }}>{actionLabel(it.action)}</span></td>
                        <td>{entityLabel(it.entity)}</td>
                        <td style={{ whiteSpace: 'normal', minWidth: 220, maxWidth: 420 }}>{it.summary}</td>
                        <td style={{ color: 'var(--atemporal-muted)' }}>{it.ip ?? '—'}</td>
                      </tr>
                      {expanded && (
                        <tr>
                          <td />
                          <td colSpan={6} style={{ whiteSpace: 'normal', background: 'var(--chart-track)' }}>
                            <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem' }}>
                              <div><b>Solicitud:</b> <code>{it.method} {it.path}</code> · estado {it.statusCode}</div>
                              {it.entityId && <div><b>Registro afectado:</b> #{it.entityId}</div>}
                              {it.userAgent && <div style={{ color: 'var(--atemporal-muted)' }}><b>Navegador:</b> {it.userAgent}</div>}
                              {pretty(it.details) && (
                                <div>
                                  <b>Datos enviados</b> <span className="dz-sub">(contraseñas y datos de pago se ocultan)</span>
                                  <pre style={{ margin: '6px 0 0', padding: 10, borderRadius: 8, background: 'var(--atemporal-white)', overflowX: 'auto', fontSize: '0.76rem', maxHeight: 220 }}>{pretty(it.details)}</pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </FragmentRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <span className="dz-sub">Página {page} de {pages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="dz-btn ghost" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setOpen(null); }}>Anterior</button>
              <button className="dz-btn ghost" disabled={page >= pages} onClick={() => { setPage((p) => p + 1); setOpen(null); }}>Siguiente</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const FragmentRow = ({ children }: { children: React.ReactNode }) => <>{children}</>;

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--atemporal-muted)' }}>
    {label}{children}
  </label>
);
