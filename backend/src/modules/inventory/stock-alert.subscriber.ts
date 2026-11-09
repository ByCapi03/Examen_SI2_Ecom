/**
 * STOCK ALERT SUBSCRIBER (TypeORM)
 * Detecta el momento en que el stock disponible (stock - reservado) de un inventario CRUZA hacia
 * abajo su mínimo (stockMin), sin importar quién lo modificó (venta POS, venta web, reserva,
 * movimiento manual o sincronización offline), y avisa a quien corresponda.
 * No depende de NotificationsService por inyección: se conecta mediante `onLowStock`.
 */
import { EventSubscriber, EntitySubscriberInterface, UpdateEvent } from 'typeorm';
import { Inventory } from './inventory.entity';

type LowStockHandler = (inventoryId: number) => void;
let handler: LowStockHandler | null = null;

/** Lo registra NotificationsService al iniciar. */
export const onLowStock = (fn: LowStockHandler | null) => { handler = fn; };

@EventSubscriber()
export class StockAlertSubscriber implements EntitySubscriberInterface<Inventory> {
  listenTo() { return Inventory; }

  afterUpdate(event: UpdateEvent<Inventory>) {
    const now = event.entity as Inventory | undefined;
    const before = event.databaseEntity as Inventory | undefined;
    if (!now || !before || !handler) return;
    const stock = Number(now.stock ?? before.stock);
    const reserved = Number(now.reserved ?? before.reserved);
    const min = Number(now.stockMin ?? before.stockMin ?? 0);
    const availableNow = stock - reserved;
    const availableBefore = Number(before.stock) - Number(before.reserved);
    // Solo al cruzar el umbral hacia abajo (evita repetir el aviso en cada venta siguiente)
    if (availableBefore > min && availableNow <= min) {
      const id = Number(now.id ?? before.id);
      // La transacción aún puede estar abierta: se verifica contra la BD ya confirmada.
      setTimeout(() => handler?.(id), 800);
    }
  }
}
