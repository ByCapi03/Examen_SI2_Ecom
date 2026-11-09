import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type Lang = 'es' | 'en';
export type CurrencyCode = 'BOB' | 'USD' | 'EUR' | 'PEN' | 'CLP' | 'MXN';

export interface Palette {
  id: string;
  name: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
}

export const PALETTES: Palette[] = [
  { id: 'green', name: 'Verde bosque', primary: '#182D2A', primaryDark: '#102421', primarySoft: '#213936', accent: '#C9904A' },
  { id: 'emerald', name: 'Esmeralda', primary: '#0F4C3A', primaryDark: '#0A3628', primarySoft: '#16604A', accent: '#D8B45A' },
  { id: 'navy', name: 'Azul marino', primary: '#1E2A44', primaryDark: '#141D30', primarySoft: '#2A3858', accent: '#D4A24C' },
  { id: 'burgundy', name: 'Borgoña', primary: '#4A1C24', primaryDark: '#36141A', primarySoft: '#5C2730', accent: '#D9A066' },
  { id: 'charcoal', name: 'Carbón', primary: '#2B2B2B', primaryDark: '#1C1C1C', primarySoft: '#3A3A3A', accent: '#E0B060' },
  { id: 'plum', name: 'Ciruela', primary: '#3B2346', primaryDark: '#2A1832', primarySoft: '#4B2E59', accent: '#E3A86B' },
];

export const CURRENCIES: { code: CurrencyCode; name: string; defaultRate: number }[] = [
  { code: 'BOB', name: 'Boliviano (Bs)', defaultRate: 1 },
  { code: 'USD', name: 'Dólar estadounidense', defaultRate: 6.96 },
  { code: 'EUR', name: 'Euro', defaultRate: 7.55 },
  { code: 'PEN', name: 'Sol peruano', defaultRate: 1.86 },
  { code: 'CLP', name: 'Peso chileno', defaultRate: 0.0074 },
  { code: 'MXN', name: 'Peso mexicano', defaultRate: 0.37 },
];

export interface Settings {
  theme: ThemeMode;
  paletteId: string;
  accent: string;
  lang: Lang;
  currency: CurrencyCode;
  /** Cuántos bolivianos vale 1 unidad de la moneda elegida (los datos se guardan en Bs). */
  rate: number;
  compactSidebar: boolean;
}

const DEFAULTS: Settings = {
  theme: 'light', paletteId: 'green', accent: '#C9904A',
  lang: 'es', currency: 'BOB', rate: 1, compactSidebar: false,
};

const STORAGE_KEY = 'dressed.settings';

const DICT: Record<Lang, Record<string, string>> = {
  es: {
    'nav.general': 'General', 'nav.operations': 'Operaciones', 'nav.catalog': 'Catálogo',
    'nav.analysis': 'Análisis', 'nav.admin': 'Administración',
    'nav.dashboard': 'Dashboard', 'nav.pos': 'Punto de venta', 'nav.sales': 'Ventas',
    'nav.reservations': 'Reservas', 'nav.cash': 'Sesiones de caja', 'nav.products': 'Productos',
    'nav.inventory': 'Inventario', 'nav.suppliers': 'Proveedores', 'nav.reports': 'Reportes',
    'nav.aiReports': 'Reportes con IA', 'nav.analytics': 'Analítica ML', 'nav.branches': 'Sucursales',
    'nav.users': 'Usuarios', 'nav.audit': 'Bitácora', 'nav.sync': 'Conflictos offline', 'nav.settings': 'Configuración', 'nav.store': 'Mi tienda web',
    'nav.logout': 'Cerrar sesión',
    'dash.title': 'Dashboard', 'dash.subtitle': 'Indicadores clave del negocio en tiempo real',
    'kpi.salesToday': 'Ventas de hoy', 'kpi.ordersToday': 'Transacciones hoy', 'kpi.avgTicket': 'Ticket promedio (7d)',
    'kpi.week': 'Ventas 7 días', 'kpi.reservations': 'Reservas activas', 'kpi.lowStock': 'Alertas de stock',
    'kpi.cashiers': 'Cajeros activos',
    'chart.trend': 'Tendencia de ventas', 'chart.channel': 'Ventas por canal', 'chart.top': 'Productos más vendidos',
    'chart.branch': 'Ventas por sucursal', 'chart.season': 'Ventas por temporada', 'chart.collection': 'Ventas por colección',
    'chart.funnel': 'Embudo de reservas', 'ml.title': 'Inteligencia artificial y Machine Learning',
    'filters.from': 'Desde', 'filters.to': 'Hasta', 'filters.branch': 'Sucursal', 'filters.channel': 'Canal',
    'filters.all': 'Todas', 'filters.apply': 'Aplicar', 'filters.clear': 'Limpiar',
    'rep.title': 'Reportes', 'rep.subtitle': 'Análisis detallado de ventas, productos, inventario y reservas',
    'rep.sales': 'Ventas', 'rep.products': 'Productos', 'rep.inventory': 'Inventario', 'rep.reservations': 'Reservas',
    'rep.export': 'Exportar CSV',
    'set.title': 'Configuración', 'set.subtitle': 'Personaliza la apariencia, idioma y moneda del sistema',
    'set.appearance': 'Apariencia', 'set.theme': 'Tema', 'set.light': 'Claro', 'set.dark': 'Oscuro',
    'set.palette': 'Paleta de colores', 'set.accent': 'Color de acento', 'set.language': 'Idioma',
    'set.currency': 'Moneda', 'set.rate': 'Tipo de cambio', 'set.preview': 'Vista previa',
    'set.reset': 'Restablecer', 'set.compact': 'Barra lateral compacta', 'set.regional': 'Región',
    'common.loading': 'Cargando…', 'common.noData': 'Sin datos para el período seleccionado',
  },
  en: {
    'nav.general': 'General', 'nav.operations': 'Operations', 'nav.catalog': 'Catalog',
    'nav.analysis': 'Analytics', 'nav.admin': 'Administration',
    'nav.dashboard': 'Dashboard', 'nav.pos': 'Point of sale', 'nav.sales': 'Sales',
    'nav.reservations': 'Reservations', 'nav.cash': 'Cash sessions', 'nav.products': 'Products',
    'nav.inventory': 'Inventory', 'nav.suppliers': 'Suppliers', 'nav.reports': 'Reports',
    'nav.aiReports': 'AI reports', 'nav.analytics': 'ML analytics', 'nav.branches': 'Branches',
    'nav.users': 'Users', 'nav.audit': 'Audit log', 'nav.sync': 'Offline conflicts', 'nav.settings': 'Settings', 'nav.store': 'My web store',
    'nav.logout': 'Log out',
    'dash.title': 'Dashboard', 'dash.subtitle': 'Key business indicators in real time',
    'kpi.salesToday': 'Sales today', 'kpi.ordersToday': 'Transactions today', 'kpi.avgTicket': 'Average ticket (7d)',
    'kpi.week': 'Sales last 7 days', 'kpi.reservations': 'Active reservations', 'kpi.lowStock': 'Stock alerts',
    'kpi.cashiers': 'Active cashiers',
    'chart.trend': 'Sales trend', 'chart.channel': 'Sales by channel', 'chart.top': 'Best-selling products',
    'chart.branch': 'Sales by branch', 'chart.season': 'Sales by season', 'chart.collection': 'Sales by collection',
    'chart.funnel': 'Reservation funnel', 'ml.title': 'Artificial intelligence & Machine Learning',
    'filters.from': 'From', 'filters.to': 'To', 'filters.branch': 'Branch', 'filters.channel': 'Channel',
    'filters.all': 'All', 'filters.apply': 'Apply', 'filters.clear': 'Clear',
    'rep.title': 'Reports', 'rep.subtitle': 'Detailed analysis of sales, products, inventory and reservations',
    'rep.sales': 'Sales', 'rep.products': 'Products', 'rep.inventory': 'Inventory', 'rep.reservations': 'Reservations',
    'rep.export': 'Export CSV',
    'set.title': 'Settings', 'set.subtitle': 'Customize the look, language and currency of the system',
    'set.appearance': 'Appearance', 'set.theme': 'Theme', 'set.light': 'Light', 'set.dark': 'Dark',
    'set.palette': 'Color palette', 'set.accent': 'Accent color', 'set.language': 'Language',
    'set.currency': 'Currency', 'set.rate': 'Exchange rate', 'set.preview': 'Preview',
    'set.reset': 'Reset', 'set.compact': 'Compact sidebar', 'set.regional': 'Region',
    'common.loading': 'Loading…', 'common.noData': 'No data for the selected period',
  },
};

const hexToRgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a: string, b: string, weightB: number) => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * weightB).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
};

function applyTheme(s: Settings) {
  const pal = PALETTES.find((p) => p.id === s.paletteId) ?? PALETTES[0];
  const dark = s.theme === 'dark';
  const root = document.documentElement;
  const chartBase = dark ? mix(pal.primary, '#ffffff', 0.45) : pal.primary;
  const vars: Record<string, string> = {
    '--atemporal-green': pal.primary,
    '--atemporal-green-dark': pal.primaryDark,
    '--atemporal-green-soft': pal.primarySoft,
    '--atemporal-gold': s.accent,
    '--atemporal-beige': dark ? '#8C8273' : '#CFC1A5',
    '--atemporal-cream': dark ? '#0E1413' : '#F5F2EB',
    '--atemporal-white': dark ? '#18211F' : '#FFFFFF',
    '--atemporal-text': dark ? '#ECE7DD' : '#1D2926',
    '--atemporal-muted': dark ? '#A39B8D' : '#837A6D',
    '--atemporal-border': dark ? 'rgba(207,193,165,0.14)' : 'rgba(207,193,165,0.45)',
    '--chart-1': chartBase,
    '--chart-2': s.accent,
    '--chart-3': mix(chartBase, '#ffffff', 0.32),
    '--chart-4': mix(chartBase, '#ffffff', 0.58),
    '--chart-5': mix(s.accent, '#ffffff', 0.42),
    '--chart-6': dark ? '#6F6759' : '#CFC1A5',
    '--chart-track': dark ? 'rgba(255,255,255,0.07)' : '#EEEAE1',
  };
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.style.colorScheme = dark ? 'dark' : 'light';
  root.dataset.theme = s.theme;
  root.lang = s.lang;
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
  t: (key: string) => string;
  /** Formatea un monto almacenado en Bs en la moneda configurada. */
  money: (amountBs: number, opts?: { compact?: boolean }) => string;
  num: (n: number, digits?: number) => string;
  locale: string;
}

const SettingsContext = createContext<Ctx | null>(null);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    applyTheme(settings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* almacenamiento no disponible */ }
  }, [settings]);

  const value = useMemo<Ctx>(() => {
    const locale = settings.lang === 'en' ? 'en-US' : 'es-BO';
    return {
      settings,
      locale,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      reset: () => setSettings(DEFAULTS),
      t: (key) => DICT[settings.lang][key] ?? DICT.es[key] ?? key,
      money: (amountBs, opts) => {
        const v = Number(amountBs || 0) / (settings.rate || 1);
        return new Intl.NumberFormat(locale, {
          style: 'currency', currency: settings.currency,
          notation: opts?.compact ? 'compact' : 'standard',
          maximumFractionDigits: opts?.compact ? 1 : 2,
        }).format(v);
      },
      num: (n, digits = 0) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(Number(n || 0)),
    };
  }, [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de SettingsProvider');
  return ctx;
};
