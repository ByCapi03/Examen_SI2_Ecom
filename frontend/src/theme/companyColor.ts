/**
 * Utilidades del color de la empresa (el "color principal" que el administrador elige en Mi tienda web).
 * Todo se deriva de un solo color: botones, gráficos, tablas y la cabecera de los PDF/Excel.
 */
export const DEFAULT_COMPANY_COLOR = '#182D2A';

const clamp = (n: number, a = 0, b = 1) => Math.min(Math.max(n, a), b);

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (x: number) => Math.round(clamp(x / 255) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Mezcla `hex` con `other` (0 = hex, 1 = other). */
export function mix(hex: string, other: string, amount: number): string {
  const [r1, g1, b1] = hexToRgb(hex);
  const [r2, g2, b2] = hexToRgb(other);
  return rgbToHex(r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount);
}

export const tint = (hex: string, amount: number) => mix(hex, '#FFFFFF', amount);
export const shade = (hex: string, amount: number) => mix(hex, '#000000', amount);

/** Luminancia relativa (0 negro, 1 blanco). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Color de texto legible sobre `hex`: blanco sobre fondos oscuros y casi negro sobre claros. */
export const readableOn = (hex: string) => (luminance(hex) > 0.5 ? '#1D2926' : '#FFFFFF');

/**
 * Paleta de `n` tonos del mismo color, del más intenso al más claro, para gráficos con varias series.
 * Se alternan tonos oscuros y claros para que series vecinas se distingan.
 */
export function palette(hex: string, n: number): string[] {
  const base = isHex(hex) ? hex : DEFAULT_COMPANY_COLOR;
  // Evita que un color casi blanco o casi negro deje series invisibles
  const anchor = luminance(base) > 0.75 ? shade(base, 0.35) : luminance(base) < 0.04 ? tint(base, 0.25) : base;
  const steps: Array<[boolean, number]> = [[true, 0], [false, 0.5], [true, 0.5], [false, 0.25], [true, 0.7], [true, 0.28], [false, 0.65], [true, 0.85]];
  return Array.from({ length: n }, (_, i) => {
    const [light, amount] = steps[i % steps.length];
    return amount === 0 ? anchor : light ? tint(anchor, amount) : shade(anchor, amount);
  });
}
