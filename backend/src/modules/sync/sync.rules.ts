/**
 * REGLAS DE RESOLUCIÓN DE CONFLICTOS (funciones puras, testeables)
 *
 * Política para VENTAS EN EFECTIVO registradas offline:
 *   "La venta física prevalece": el dinero ya fue cobrado y la prenda entregada,
 *   por lo tanto la venta NUNCA se descarta. Se descuenta el stock posible
 *   (jamás queda negativo) y el faltante se registra como conflicto
 *   STOCK_SHORTFALL para que el encargado lo concilie.
 *   El precio cobrado offline se respeta (es el dinero real en caja); si difiere
 *   del vigente se registra un conflicto informativo PRICE_CHANGED.
 *
 * Política para RESERVAS offline:
 *   "El servidor prevalece": una reserva no implica dinero cobrado, por lo que
 *   solo se aplica si TODO el stock está disponible al sincronizar; si no, se
 *   rechaza con conflicto STOCK_UNAVAILABLE y se sugieren sucursales alternativas.
 */

export interface StockResolution {
  /** Unidades efectivamente descontadas del stock físico. */
  deducted: number;
  /** Unidades vendidas offline que el servidor no tenía disponibles. */
  shortfall: number;
  newStock: number;
  /** true si la venta consumió unidades que estaban apartadas por reservas. */
  affectsReservations: boolean;
}

export function resolveOfflineSaleStock(requested: number, stock: number, reserved: number): StockResolution {
  if (requested <= 0) throw new Error('Cantidad inválida');
  const safeStock = Math.max(stock, 0);
  const available = Math.max(safeStock - reserved, 0);
  const deducted = Math.min(requested, safeStock);
  const shortfall = requested - deducted;
  return {
    deducted,
    shortfall,
    newStock: safeStock - deducted,
    affectsReservations: requested > available && reserved > 0 && deducted > available,
  };
}

export function priceDiffers(offlineUnitPrice: number, currentUnitPrice: number, tolerance = 0.01): boolean {
  return Math.abs(Number(offlineUnitPrice) - Number(currentUnitPrice)) > tolerance;
}

export function canFulfillReservation(requested: number, stock: number, reserved: number): boolean {
  return stock - reserved >= requested;
}

/** Orden determinista de procesamiento: primero lo que ocurrió antes en el mundo real. */
export function sortOperations<T extends { clientCreatedAt: string | Date; operationId: string }>(ops: T[]): T[] {
  return [...ops].sort((a, b) => {
    const diff = new Date(a.clientCreatedAt).getTime() - new Date(b.clientCreatedAt).getTime();
    return diff !== 0 ? diff : a.operationId.localeCompare(b.operationId);
  });
}
