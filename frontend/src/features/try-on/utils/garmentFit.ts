/** Recorta el espacio transparente de la imagen de la prenda para que se ajuste al cuerpo y no se vea "chica". */
export interface Trim { sx: number; sy: number; sw: number; sh: number }
const cache = new WeakMap<HTMLImageElement, Trim>();

export const getTrim = (img: HTMLImageElement): Trim => {
  const hit = cache.get(img);
  if (hit) return hit;
  const full: Trim = { sx: 0, sy: 0, sw: img.naturalWidth || img.width, sh: img.naturalHeight || img.height };
  try {
    const max = 256;
    const k = Math.min(1, max / Math.max(full.sw, full.sh));
    const w = Math.max(1, Math.round(full.sw * k)), h = Math.max(1, Math.round(full.sh * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (d[(j * w + i) * 4 + 3] > 24) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    }
    if (x1 >= 0 && (x1 - x0) > 4 && (y1 - y0) > 4) {
      const t = { sx: x0 / k, sy: y0 / k, sw: (x1 - x0 + 1) / k, sh: (y1 - y0 + 1) / k };
      cache.set(img, t); return t;
    }
  } catch { /* imagen sin CORS: se usa completa */ }
  cache.set(img, full); return full;
};

/** Dibuja la prenda recortada dentro de (dx, dy, dw, dh). */
export const drawFitted = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) => {
  const t = getTrim(img);
  ctx.drawImage(img, t.sx, t.sy, t.sw, t.sh, dx, dy, dw, dh);
};

/** Alto proporcional al ancho, limitado a un rango razonable según el cuerpo. */
export const fitHeight = (img: HTMLImageElement, width: number, minH: number, maxH: number) => {
  const t = getTrim(img);
  return Math.min(maxH, Math.max(minH, width * (t.sh / t.sw)));
};
