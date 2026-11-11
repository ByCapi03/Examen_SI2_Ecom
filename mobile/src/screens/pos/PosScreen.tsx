import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { colors, radius, spacing, typography } from '../../theme/theme';
import { useAuth } from '../../context/AuthContext';
import { PendingSyncBanner } from '../../sync/PendingSyncBanner';
import { useOfflineQueue } from '../../sync/useOfflineSync';
import { isNetworkError } from '../../sync/syncService';
import { downloadPosData, registerCashSale } from '../../sync/posService';
import { LocalSale, PosBranch, PosClient, posRepository } from '../../database/pos.repository';
import { CartLine, PosItem, addToCart, cartTotal, cartUnits, isStale, setQuantity } from '../../pos/posLogic';

const STATUS: Record<string, { text: string; color: string }> = {
  PENDIENTE: { text: 'Pendiente de sincronizar', color: '#b45309' },
  ERROR: { text: 'Reintentará al haber red', color: '#b45309' },
  SINCRONIZANDO: { text: 'Sincronizando…', color: '#1d4ed8' },
  SINCRONIZADA: { text: 'Confirmada por el servidor', color: '#15803d' },
  CON_CONFLICTO: { text: 'Aceptada con conflicto', color: '#b91c1c' },
  RECHAZADA: { text: 'Rechazada', color: '#b91c1c' },
};

/** Caja POS: vende al contado con la copia local (SQLite), con o sin conexión. */
export const PosScreen: React.FC = () => {
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const { queue } = useOfflineQueue();

  const [branch, setBranch] = useState<PosBranch | null>(null);
  const [downloadedAt, setDownloadedAt] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PosItem[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState<PosClient[]>([]);
  const [client, setClient] = useState<PosClient | null>(null);
  const [sales, setSales] = useState<LocalSale[]>([]);
  const [saving, setSaving] = useState(false);

  const loadLocal = useCallback(async () => {
    const branchId = Number(await posRepository.getMeta('pos_branch_id'));
    if (branchId) {
      setBranch(await posRepository.getBranch(branchId));
      setItems(await posRepository.searchInventory(branchId, search));
    }
    const at = await posRepository.getMeta('pos_downloaded_at');
    setDownloadedAt(at ? Number(at) : null);
    if (user?.id) setSales(await posRepository.listLocalSales(user.tenantId ?? 0, user.id));
  }, [search, user]);

  const download = useCallback(async () => {
    setDownloading(true);
    setNotice(null);
    try {
      const r = await downloadPosData();
      setNotice(`Datos actualizados: ${r.products} prendas y ${r.clients} clientes. ${r.cashSessionId ? '' : 'No tienes caja abierta; la venta se asignará a tu caja al sincronizar.'}`);
    } catch (err: any) {
      setNotice(isNetworkError(err)
        ? 'Sin conexión: se usan los datos guardados en el dispositivo.'
        : (err?.response?.data?.message ?? 'No se pudieron descargar los datos de la caja.'));
    } finally {
      setDownloading(false);
      await loadLocal();
    }
  }, [loadLocal]);

  useEffect(() => { if (isFocused) void download(); }, [isFocused]);
  useEffect(() => { void loadLocal(); }, [loadLocal, queue]);
  useEffect(() => {
    let alive = true;
    void posRepository.searchClients(clientSearch).then((r) => { if (alive) setClientResults(r); });
    return () => { alive = false; };
  }, [clientSearch]);

  const charge = async () => {
    setSaving(true);
    try {
      const op = await registerCashSale(cart, client);
      setCart([]);
      setClient(null);
      setClientSearch('');
      Alert.alert('Venta registrada', `${op.summary}\nSe guardó en el dispositivo y se sincronizará automáticamente.`);
      await loadLocal();
    } catch (err: any) {
      Alert.alert('No se pudo registrar', err?.message ?? 'Error desconocido');
    } finally {
      setSaving(false);
    }
  };

  const stale = isStale(downloadedAt, Date.now());

  const header = (
    <View>
      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>{branch ? `Sucursal: ${branch.name}` : 'Caja sin datos locales'}</Text>
        <Text style={[styles.caption, stale && { color: '#b45309', fontWeight: '700' }]}>
          {downloadedAt ? `Datos guardados el ${new Date(downloadedAt).toLocaleString()}` : 'Aún no se descargaron los datos'}
          {stale ? ' — pueden estar desactualizados' : ''}
        </Text>
        {notice ? <Text style={styles.caption}>{notice}</Text> : null}
        <Pressable style={styles.button} onPress={() => void download()} disabled={downloading}>
          {downloading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Descargar / actualizar datos</Text>}
        </Pressable>
      </View>

      <PendingSyncBanner />

      <Text style={styles.section}>Carrito ({cartUnits(cart)} prendas)</Text>
      {cart.length === 0 ? <Text style={styles.caption}>Toca una prenda de la lista para agregarla.</Text> : null}
      {cart.map((l) => (
        <View key={l.variantId} style={styles.line}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bold}>{l.productName}</Text>
            <Text style={styles.caption}>{l.size} · {l.color} · Bs {l.unitPrice.toFixed(2)}</Text>
          </View>
          <Pressable style={styles.qtyBtn} onPress={() => setCart(setQuantity(cart, l.variantId, l.quantity - 1))}><Text style={styles.qtyText}>−</Text></Pressable>
          <Text style={styles.qty}>{l.quantity}</Text>
          <Pressable style={styles.qtyBtn} onPress={() => setCart(setQuantity(cart, l.variantId, l.quantity + 1))}><Text style={styles.qtyText}>+</Text></Pressable>
        </View>
      ))}

      <Text style={styles.section}>Cliente (opcional)</Text>
      {client ? (
        <Pressable onPress={() => setClient(null)} style={styles.clientChip}>
          <Text style={styles.bold}>{client.name} {client.lastName} ✕</Text>
        </Pressable>
      ) : (
        <>
          <TextInput style={styles.input} placeholder="Buscar cliente guardado…" value={clientSearch} onChangeText={setClientSearch} />
          {clientSearch.trim() ? clientResults.slice(0, 5).map((c) => (
            <Pressable key={c.id} onPress={() => { setClient(c); setClientSearch(''); }} style={styles.clientRow}>
              <Text>{c.name} {c.lastName}{c.email ? ` · ${c.email}` : ''}</Text>
            </Pressable>
          )) : <Text style={styles.caption}>Sin cliente: venta de mostrador.</Text>}
        </>
      )}

      <Pressable
        style={[styles.button, styles.charge, (!cart.length || saving) && { opacity: 0.5 }]}
        onPress={() => void charge()}
        disabled={!cart.length || saving}
      >
        <Text style={styles.buttonText}>Cobrar en efectivo — Bs {cartTotal(cart).toFixed(2)}</Text>
      </Pressable>
      <Text style={styles.caption}>Solo efectivo sin conexión. El servidor confirma la venta al sincronizar.</Text>

      <Text style={styles.section}>Productos (existencia conocida)</Text>
      <TextInput style={styles.input} placeholder="Buscar prenda o SKU…" value={search} onChangeText={setSearch} />
    </View>
  );

  const footer = (
    <View>
      <Text style={styles.section}>Ventas de esta caja</Text>
      {sales.length === 0 ? <Text style={styles.caption}>Todavía no registraste ventas en este dispositivo.</Text> : null}
      {sales.map((s) => (
        <View key={s.operationId} style={styles.sale}>
          <Text style={styles.bold}>Bs {s.total.toFixed(2)}{s.clientName ? ` · ${s.clientName}` : ''}</Text>
          <Text style={styles.caption}>{new Date(s.createdAt).toLocaleString()} · {s.items.reduce((a, i) => a + i.quantity, 0)} prenda(s)</Text>
          <Text style={{ color: STATUS[s.status]?.color, fontWeight: '600' }}>
            {STATUS[s.status]?.text}{s.saleId ? ` · Venta #${s.saleId}` : ''}
          </Text>
          {s.lastError ? <Text style={styles.error}>{s.lastError}</Text> : null}
          {s.conflicts?.map((c, i) => <Text key={i} style={styles.error}>⚠ {c.message}</Text>)}
        </View>
      ))}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.cream }}
      contentContainerStyle={{ padding: spacing.md }}
      data={items}
      keyExtractor={(i) => String(i.variantId)}
      ListHeaderComponent={header}
      ListFooterComponent={footer}
      ListEmptyComponent={<Text style={styles.caption}>No hay prendas con existencia en la copia local.</Text>}
      renderItem={({ item }) => {
        const inCart = cart.find((l) => l.variantId === item.variantId)?.quantity ?? 0;
        return (
          <Pressable style={styles.product} onPress={() => setCart(addToCart(cart, item))}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{item.productName}</Text>
              <Text style={styles.caption}>{item.size} · {item.color}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.bold}>Bs {item.finalPrice.toFixed(2)}</Text>
              <Text style={styles.caption}>Disp. {item.available - inCart}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  statusBox: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: 6 },
  statusTitle: { ...typography.h3 },
  caption: { ...typography.caption },
  bold: { ...typography.body, fontWeight: '700' },
  section: { ...typography.subtitle, color: colors.primary, marginTop: spacing.md, marginBottom: spacing.sm },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', marginTop: spacing.sm },
  charge: { backgroundColor: colors.gold },
  buttonText: { color: colors.white, fontWeight: '700' },
  input: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  line: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6, gap: 8 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.beige, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontSize: 18, fontWeight: '700' },
  qty: { minWidth: 20, textAlign: 'center', fontWeight: '700' },
  clientChip: { backgroundColor: colors.white, borderRadius: radius.full, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'flex-start' },
  clientRow: { backgroundColor: colors.white, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  product: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginTop: 6, gap: 8 },
  sale: { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: 8, gap: 2 },
  error: { color: '#b91c1c', fontSize: 12 },
});
