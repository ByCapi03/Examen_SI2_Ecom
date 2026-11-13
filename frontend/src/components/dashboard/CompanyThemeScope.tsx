import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { usePlan } from '../../features/saas/PlanContext';
import { DEFAULT_COMPANY_COLOR, isHex, palette, readableOn, shade, tint } from '../../theme/companyColor';

/** Color principal de la empresa (el que el administrador eligió en Mi tienda web) y sus derivados. */
export function useCompanyColor() {
  const { tenant } = usePlan();
  const configured = tenant?.storeConfig?.accentColor;
  return useMemo(() => {
    const color = isHex(configured) ? configured : DEFAULT_COMPANY_COLOR;
    return { color, onColor: readableOn(color), soft: tint(color, 0.88), dark: shade(color, 0.25), palette: (n: number) => palette(color, n) };
  }, [configured]);
}

/**
 * Pinta de un solo color (el de la empresa) todo lo que haya dentro: botones, pestañas activas, enlaces y gráficos.
 * Funciona redefiniendo las variables CSS del panel solo para este bloque.
 */
export const CompanyThemeScope = ({ children }: { children: ReactNode }) => {
  const { color, onColor, soft, palette: pal } = useCompanyColor();
  const series = pal(6);
  const vars = {
    '--atemporal-green': color,
    '--atemporal-gold': color,
    '--company-on': onColor,
    '--company-soft': soft,
    '--chart-1': series[0], '--chart-2': series[1], '--chart-3': series[2],
    '--chart-4': series[3], '--chart-5': series[4], '--chart-6': series[5],
    '--chart-track': soft,
  } as CSSProperties;
  return (
    <div className="company-scope" style={vars}>
      <style>{`
        .company-scope .dz-btn:not(.ghost) { color: var(--company-on); }
        .company-scope .dz-tab.on { color: var(--company-on); }
        .company-scope .dz-input:focus { border-color: var(--atemporal-green); }
        .company-scope .dz-table th { color: var(--atemporal-green); }
      `}</style>
      {children}
    </div>
  );
};
