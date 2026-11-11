/**
 * Caja POS offline (móvil).
 *  - downloadPosData(): con conexión, descarga y guarda en SQLite la sucursal del cajero,
 *    sus existencias/precios y clientes mínimos.
 *  - registerCashSale(): registra una venta de contado en SQLite (también sin conexión) y la
 *    deja PENDIENTE en la cola; se envía a POST /sync/batch cuando hay red (idempotente por UUID).
 */
import { api } from '../api/api';
import { posRepository, PosClient, PosBranch, RemotePosProduct } from '../database/pos.repository';
import { OfflineOperation } from '../database/offlineQueue.repository';
import { CartLine, buildSalePayload, cartTotal, saleSummary, validateCart } from '../pos/posLogic';
import { currentUser, flush, syncEvents, uuidv4 } from './syncService';

export interface PosDownload { branch: PosBranch; products: number; clients: number; cashSessionId: number | null }

export async function downloadPosData(): Promise<PosDownload> {
  const cash = (await api.get('/cash-sessions/current')).data;
  const branch: PosBranch = { id: cash.branch.id, name: cash.branch.name };
  const cashSessionId: number | null = cash.status === 'OPEN' ? cash.session.id : null;
  const [products, clients] = await Promise.all([
    api.get<RemotePosProduct[]>('/pos/products'),
    api.get<PosClient[]>('/pos/clients'),
  ]);
  await posRepository.saveSnapshot(branch, products.data, clients.data);
  await posRepository.setMeta('pos_branch_id', String(branch.id));
  await posRepository.setMeta('pos_cash_session_id', cashSessionId ? String(cashSessionId) : '');
  return { branch, products: products.data.length, clients: clients.data.length, cashSessionId };
}

export async function registerCashSale(cart: CartLine[], client: PosClient | null): Promise<OfflineOperation> {
  const invalid = validateCart(cart);
  if (invalid) throw new Error(invalid);
  const user = await currentUser();
  if (!user?.tenantId) throw new Error('Debes iniciar sesión para registrar ventas');
  const branchId = Number(await posRepository.getMeta('pos_branch_id'));
  if (!branchId) throw new Error('Descarga primero los datos de la caja (con conexión).');
  const sessionRaw = await posRepository.getMeta('pos_cash_session_id');

  const op: OfflineOperation = {
    operationId: uuidv4(),
    tenantId: user.tenantId,
    userId: user.id,
    type: 'POS_CASH_SALE',
    clientCreatedAt: new Date().toISOString(),
    payload: buildSalePayload(cart, { cashSessionId: sessionRaw ? Number(sessionRaw) : null, clientId: client?.id ?? null }),
    summary: saleSummary(cart),
    status: 'PENDIENTE',
    attempts: 0,
  };
  await posRepository.createLocalSale(
    op,
    { branchId, clientId: client?.id ?? null, clientName: client ? `${client.name} ${client.lastName}`.trim() : null, total: cartTotal(cart) },
    cart.map((l) => ({ variantId: l.variantId, productName: l.productName, size: l.size, color: l.color, quantity: l.quantity, unitPrice: l.unitPrice })),
  );
  syncEvents.emit();
  void flush();
  return op;
}
