import { canFulfillReservation, priceDiffers, resolveOfflineSaleStock, sortOperations } from './sync.rules';

describe('Reglas de resolución de conflictos offline', () => {
  it('venta con stock suficiente: descuenta todo sin faltante', () => {
    expect(resolveOfflineSaleStock(2, 10, 3)).toEqual({ deducted: 2, shortfall: 0, newStock: 8, affectsReservations: false });
  });

  it('venta mayor al stock físico: nunca deja stock negativo y reporta faltante', () => {
    const r = resolveOfflineSaleStock(5, 3, 0);
    expect(r.newStock).toBe(0);
    expect(r.deducted).toBe(3);
    expect(r.shortfall).toBe(2);
  });

  it('venta que consume unidades reservadas: marca afectación de reservas', () => {
    const r = resolveOfflineSaleStock(2, 2, 1); // disponible = 1
    expect(r.shortfall).toBe(0);
    expect(r.affectsReservations).toBe(true);
  });

  it('rechaza cantidades inválidas', () => {
    expect(() => resolveOfflineSaleStock(0, 5, 0)).toThrow();
  });

  it('detecta diferencias de precio con tolerancia de centavos', () => {
    expect(priceDiffers(100, 100.005)).toBe(false);
    expect(priceDiffers(100, 90)).toBe(true);
  });

  it('reserva solo procede si hay stock libre suficiente', () => {
    expect(canFulfillReservation(2, 5, 3)).toBe(true);
    expect(canFulfillReservation(3, 5, 3)).toBe(false);
  });

  it('ordena operaciones por fecha real del dispositivo (determinista)', () => {
    const ops = sortOperations([
      { operationId: 'b', clientCreatedAt: '2026-01-01T10:00:00Z' },
      { operationId: 'a', clientCreatedAt: '2026-01-01T09:00:00Z' },
      { operationId: 'c', clientCreatedAt: '2026-01-01T09:00:00Z' },
    ]);
    expect(ops.map((o) => o.operationId)).toEqual(['a', 'c', 'b']);
  });
});
