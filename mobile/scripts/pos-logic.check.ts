/**
 * Verificación de la lógica pura de la caja POS offline (sin dependencias de React Native).
 * Ejecutar desde mobile/:   npx tsx scripts/pos-logic.check.ts   (o ts-node)
 */
import assert from 'node:assert/strict';
import { addToCart, buildSalePayload, cartTotal, cartUnits, isStale, remainingAfterSale, saleSummary, setQuantity, validateCart } from '../src/pos/posLogic';

const item = { variantId: 7, productName: 'Vestido', size: 'M', color: 'Negro', finalPrice: 99.9, available: 2 };

let cart = addToCart([], item);
cart = addToCart(cart, item);
assert.equal(cartUnits(cart), 2, 'suma unidades');
cart = addToCart(cart, item);
assert.equal(cartUnits(cart), 2, 'no supera la existencia conocida');
assert.equal(cartTotal(cart), 199.8, 'total sin error de coma flotante');
assert.equal(validateCart(cart), null);
assert.equal(validateCart([]), 'El carrito está vacío.');
assert.deepEqual(addToCart([], { ...item, available: 0 }), [], 'no agrega prendas sin existencia');
cart = setQuantity(cart, 7, 1);
assert.equal(cart[0].quantity, 1);
assert.deepEqual(setQuantity(cart, 7, 0), [], 'cantidad 0 quita la línea');

const p = buildSalePayload(addToCart([], item), { cashSessionId: 12, clientId: null });
assert.deepEqual(p, { cashSessionId: 12, items: [{ variantId: 7, quantity: 1, unitPrice: 99.9 }] });
assert.equal(saleSummary(addToCart([], item)), 'Venta efectivo Bs 99.90 — 1 prenda(s)');

assert.equal(remainingAfterSale(1, 3), 0, 'existencia nunca negativa');
const now = Date.now();
assert.equal(isStale(null, now), true);
assert.equal(isStale(now - 3600_000, now), false);
assert.equal(isStale(now - 13 * 3600_000, now), true);
console.log('✔ pos-logic: todas las comprobaciones pasaron');
