import { Sun, Moon, Check, RotateCcw, Palette, Globe, Coins, PanelLeft } from 'lucide-react';
import { useSettings, PALETTES, CURRENCIES } from '../../config/SettingsContext';
import type { CurrencyCode } from '../../config/SettingsContext';
import { DashStyles, PageHeader, Card, KpiCard, ColumnChart } from '../../components/dashboard/ui';

const ACCENTS = ['#C9904A', '#D8B45A', '#B76E79', '#7FA88A', '#6C8EBF', '#E07A5F'];

const Option = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button onClick={onClick} style={{
      position: 'relative', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 12, padding: 12,
      border: `2px solid ${active ? 'var(--atemporal-gold)' : 'var(--atemporal-border)'}`, background: 'var(--atemporal-white)', color: 'var(--atemporal-text)',
    }}>
      {active && <span style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%', background: 'var(--atemporal-gold)', color: '#fff', display: 'grid', placeItems: 'center' }}><Check size={12} /></span>}
      {children}
    </button>
  );

const SectionTitle = ({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--chart-track)', color: 'var(--chart-1)' }}>{icon}</span>
      <div><h3 style={{ margin: 0, fontSize: '0.98rem' }}>{title}</h3><p className="dz-sub">{sub}</p></div>
    </div>
  );


export const SettingsPage = () => {
  const { settings, update, reset, t, money } = useSettings();

  const currency = CURRENCIES.find((c) => c.code === settings.currency)!;

  return (
    <div className="dz-page">
      <DashStyles />
      <PageHeader title={t('set.title')} subtitle={t('set.subtitle')}
        actions={<button className="dz-btn ghost" onClick={reset}><RotateCcw size={15} /> {t('set.reset')}</button>} />

      <div className="dz-grid dz-2-1">
        <div className="dz-grid">
          {/* Tema */}
          <Card>
            <SectionTitle icon={<Sun size={17} />} title={t('set.theme')} sub="Modo de visualización del panel" />
            <div className="dz-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
              {([['light', t('set.light'), <Sun size={18} />, '#F5F2EB', '#fff'], ['dark', t('set.dark'), <Moon size={18} />, '#0E1413', '#18211F']] as const).map(([id, label, icon, bg, card]) => (
                <Option key={id} active={settings.theme === id} onClick={() => update({ theme: id })}>
                  <div style={{ height: 64, borderRadius: 8, background: bg, padding: 8, display: 'flex', gap: 6, marginBottom: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{ width: 18, borderRadius: 4, background: 'var(--atemporal-green)' }} />
                    <div style={{ flex: 1, borderRadius: 4, background: card }} />
                  </div>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem' }}>{icon}{label}</span>
                </Option>
              ))}
            </div>
          </Card>

          {/* Paleta */}
          <Card>
            <SectionTitle icon={<Palette size={17} />} title={t('set.palette')} sub="Color principal de la barra lateral, botones y gráficos" />
            <div className="dz-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
              {PALETTES.map((p) => (
                <Option key={p.id} active={settings.paletteId === p.id} onClick={() => update({ paletteId: p.id, accent: p.accent })}>
                  <div style={{ display: 'flex', height: 34, borderRadius: 8, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ flex: 3, background: p.primary }} /><div style={{ flex: 2, background: p.primarySoft }} /><div style={{ flex: 1, background: p.accent }} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{p.name}</span>
                </Option>
              ))}
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--atemporal-muted)', marginBottom: 8 }}>{t('set.accent')}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {ACCENTS.map((c) => (
                  <button key={c} onClick={() => update({ accent: c })} aria-label={c} style={{
                    width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: settings.accent.toLowerCase() === c.toLowerCase() ? '3px solid var(--atemporal-text)' : '3px solid transparent',
                  }} />
                ))}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--atemporal-muted)' }}>
                  <input type="color" value={settings.accent} onChange={(e) => update({ accent: e.target.value })} style={{ width: 36, height: 32, border: 'none', background: 'none', cursor: 'pointer' }} />
                  Personalizado
                </label>
              </div>
            </div>
          </Card>

          {/* Región */}
          <Card>
            <SectionTitle icon={<Globe size={17} />} title={t('set.regional')} sub="Idioma de la interfaz y moneda de los montos" />
            <div className="dz-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--atemporal-muted)' }}>
                {t('set.language')}
                <select className="dz-input" value={settings.lang} onChange={(e) => update({ lang: e.target.value as 'es' | 'en' })}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--atemporal-muted)' }}>
                {t('set.currency')}
                <select className="dz-input" value={settings.currency} onChange={(e) => {
                  const c = CURRENCIES.find((x) => x.code === e.target.value)!;
                  update({ currency: c.code as CurrencyCode, rate: c.defaultRate });
                }}>
                  {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                </select>
              </label>
              {settings.currency !== 'BOB' && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--atemporal-muted)' }}>
                  {t('set.rate')} (1 {settings.currency} = ? Bs)
                  <input type="number" min="0.0001" step="0.0001" className="dz-input" value={settings.rate}
                    onChange={(e) => update({ rate: Math.max(Number(e.target.value) || currency.defaultRate, 0.0001) })} />
                </label>
              )}
            </div>
            <p className="dz-sub" style={{ marginTop: 10 }}>
              <Coins size={12} style={{ verticalAlign: -2 }} /> Los montos se registran en bolivianos (Bs); la conversión es referencial y sólo afecta la visualización.
            </p>
          </Card>

          {/* Barra lateral */}
          <Card>
            <SectionTitle icon={<PanelLeft size={17} />} title={t('set.compact')} sub="Muestra sólo los íconos para ganar espacio" />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.88rem' }}>
              <span onClick={() => update({ compactSidebar: !settings.compactSidebar })} style={{
                width: 44, height: 24, borderRadius: 999, position: 'relative', transition: 'background .2s',
                background: settings.compactSidebar ? 'var(--atemporal-green)' : 'var(--chart-track)',
              }}>
                <span style={{ position: 'absolute', top: 3, left: settings.compactSidebar ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </span>
              {settings.compactSidebar ? 'Activada' : 'Desactivada'}
            </label>
          </Card>
        </div>

        {/* Vista previa */}
        <div style={{ position: 'sticky', top: 16, alignSelf: 'start' }}>
          <Card title={t('set.preview')} subtitle="Así se verán tus indicadores">
            <div className="dz-grid" style={{ gap: 12 }}>
              <KpiCard label={t('kpi.salesToday')} value={money(12450.5)} delta={8.4} spark={[3, 5, 4, 7, 6, 9, 11]} />
              <KpiCard label={t('kpi.reservations')} value="27" tone="accent" />
              <div style={{ border: '1px solid var(--atemporal-border)', borderRadius: 12, padding: 12 }}>
                <ColumnChart height={150} format={(v) => money(v, { compact: true })} rows={[
                  { label: 'Centro', value: 18400 }, { label: 'Norte', value: 12100 }, { label: 'Sur', value: 9300 }, { label: 'Web', value: 15200 },
                ]} />
              </div>
              <button className="dz-btn" style={{ justifyContent: 'center' }}>Botón principal</button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
