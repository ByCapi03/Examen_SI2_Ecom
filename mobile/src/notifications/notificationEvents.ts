/** Aviso interno: cuando llega una push con la app abierta, la campanita se actualiza al instante. */
type Listener = () => void;
const listeners = new Set<Listener>();

export const notificationEvents = {
  subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  emit() { listeners.forEach((fn) => fn()); },
};
