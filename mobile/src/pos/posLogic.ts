/**
 * Lógica pura de la caja POS offline (sin React Native ni SQLite): se puede probar sola.
 * Los importes se manejan en centavos para evitar errores de coma flotante.
 */
export interface PosItem {
  variantId: number;
  productName: string;
  size: string;
  color: string;
  finalPrice: number;
  /** Existencia conocida en la copia local (se descuenta al vender). */
  available: number;
}

export interface CartLine {
  variantId: number;
  productName: string;
  size: string;
  color: string;
  unitPrice: number;
  quantity: number;
  available: number;
}

export const toCents = (n: number) => Math.round(n * 100);
export const fromCents = (c: number) => c / 100;

export function addToCart(cart: CartLine[], item: PosItem): CartLine[] {
  const line = cart.find((l) => l.variantId === item.variantId);
  if (line) {
    if (line.quantity >= item.available) return cart;
    return cart.map((l) => (l.variantId === item.variantId ? { ...l, quantity: l.quantity + 1 } : l));
  }
  if (item.available <= 0) return cart;
  return [...cart, {
    variantId: item.variantId, productName: item.productName, size: item.size, color: item.color,
    unitPrice: item.finalPrice, quantity: 1, available: item.available,
  }];
}

export function setQuantity(cart: CartLine[], variantId: number, quantity: number): CartLine[] {
  if (quantity <= 0) return cart.filter((l) => l.variantId !== variantId);
  return cart.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(Math.floor(quantity), l.available) } : l));
}

export const cartUnits = (cart: CartLine[]) => cart.reduce((a, l) => a + l.quantity, 0);

export const cartTotal = (cart: CartLine[]) =>
  fromCents(cart.reduce((a, l) => a + toCents(l.unitPrice) * l.quantity, 0));

export function validateCart(cart: CartLine[]): string | null {
  if (!cart.length) return 'El carrito está vacío.';
  const over = cart.find((l) => l.quantity > l.available);
  if (over) return `"${over.productName}" supera la existencia conocida (${over.available}).`;
  return null;
}

/** Cuerpo que se envía a POST /sync/batch (sin operationId/type/fecha: los agrega la cola). */
export function buildSalePayload(cart: CartLine[], opts: { cashSessionId?: number | null; clientId?: number | null }) {
  return {
    ...(opts.cashSessionId ? { cashSessionId: opts.cashSessionId } : {}),
    ...(opts.clientId ? { clientId: opts.clientId } : {}),
    items: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitPrice: l.unitPrice })),
  };
}

export const saleSummary = (cart: CartLine[]) =>
  `Venta efectivo Bs ${cartTotal(cart).toFixed(2)} — ${cartUnits(cart)} prenda(s)`;

/** ¿La copia local de existencias pudo quedar desactualizada? */
export function isStale(downloadedAtMs: number | null, nowMs: number, hours = 12): boolean {
  return downloadedAtMs == null || nowMs - downloadedAtMs > hours * 3600 * 1000;
}

/** Existencia local luego de vender (nunca negativa). */
export function remainingAfterSale(available: number, sold: number) {
  return Math.max(0, available - sold);
}
