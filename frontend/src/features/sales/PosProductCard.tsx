import { useMemo, useState } from 'react';

export interface PosVariant {
  productId: number;
  variantId: number;
  productName: string;
  imageUrl: string | null;
  sku: string;
  size: string;
  color: string;
  price: string;
  available: number;
  finalPrice?: number | string;
  discount?: { type: string; value: number | string } | null;
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
const sizeRank = (s: string) => { const i = SIZE_ORDER.indexOf(s.toUpperCase()); return i === -1 ? 100 : i; };

const COLOR_HEX: Record<string, string> = {
  negro: '#1a1a1a', blanco: '#ffffff', beige: '#d9c7a3', rojo: '#c0392b', verde: '#2e7d4f', azul: '#2c5fa8',
  amarillo: '#f2c230', gris: '#9aa0a6', cafe: '#6f4e37', café: '#6f4e37', rosa: '#e58fb0', morado: '#7b4fa3', naranja: '#e8873a',
};
const dot = (name: string) => COLOR_HEX[name.toLowerCase()] ?? '#bbb';

/**
 * Una tarjeta por PRENDA: el cajero elige color y talla y se agrega esa variante al carrito.
 * `preferredVariantId` preselecciona la variante que coincide con la búsqueda (p. ej. un SKU escaneado).
 */
export const PosProductCard = ({ variants, preferredVariantId, inCart, onAdd }: {
  variants: PosVariant[];
  preferredVariantId?: number;
  inCart: (variantId: number) => number;
  onAdd: (v: PosVariant) => void;
}) => {
  const first = variants[0];
  const [picked, setPicked] = useState<number | null>(null);

  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size))].sort((a, b) => sizeRank(a) - sizeRank(b) || a.localeCompare(b)), [variants]);

  const byId = (id: number | null | undefined) => variants.find((v) => v.variantId === id);
  const current = byId(picked) ?? byId(preferredVariantId) ?? variants.find((v) => inCart(v.variantId) < v.available) ?? first;

  const find = (color: string, size: string) => variants.find((v) => v.color === color && v.size === size);
  const pickColor = (color: string) => {
    const v = find(color, current.size) ?? variants.find((v) => v.color === color);
    if (v) setPicked(v.variantId);
  };
  const pickSize = (size: string) => {
    const v = find(current.color, size);
    if (v) setPicked(v.variantId);
  };

  const inCartTotal = variants.reduce((a, v) => a + inCart(v.variantId), 0);
  const inCartHere = inCart(current.variantId);
  const canAdd = inCartHere < current.available;
  const totalStock = variants.reduce((a, v) => a + v.available, 0);
  const image = current.imageUrl ?? variants.find((v) => v.imageUrl)?.imageUrl ?? null;

  const chip = (selected: boolean, disabled: boolean): React.CSSProperties => ({
    padding: '4px 9px', borderRadius: 999, fontSize: '0.78rem', cursor: disabled ? 'not-allowed' : 'pointer',
    border: selected ? '2px solid #007bff' : '1px solid #ccc', background: selected ? '#e8f1ff' : '#fff',
    color: disabled ? '#bbb' : '#222', fontWeight: selected ? 700 : 500, opacity: disabled ? 0.55 : 1,
    display: 'inline-flex', alignItems: 'center', gap: 5, textDecoration: disabled ? 'line-through' : 'none',
  });

  return (
    <div style={{ border: inCartTotal ? '2px solid #007bff' : '1px solid #ddd', borderRadius: 8, padding: 14, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 110, backgroundColor: '#f5f5f5', marginBottom: 10, borderRadius: 4, overflow: 'hidden' }}>
        {image ? (
          <img src={image} alt={first.productName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: '0.8rem' }}>Sin imagen</div>
        )}
      </div>
      <h5 style={{ margin: '0 0 2px 0', fontSize: '1rem' }}>{first.productName}</h5>
      <p style={{ margin: '0 0 8px 0', fontSize: '0.74rem', color: '#777' }}>
        {variants.length} variante(s) · {totalStock} u. en total{inCartTotal ? ` · ${inCartTotal} en el carrito` : ''}
      </p>

      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Color</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {colors.map((c) => (
          <button key={c} type="button" onClick={() => pickColor(c)} style={chip(c === current.color, false)}>
            <span style={{ width: 11, height: 11, borderRadius: '50%', background: dot(c), border: '1px solid #999', display: 'inline-block' }} />{c}
          </button>
        ))}
      </div>

      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Talla</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
        {sizes.map((s) => {
          const exists = !!find(current.color, s);
          return (
            <button key={s} type="button" disabled={!exists} onClick={() => pickSize(s)} style={chip(s === current.size, !exists)}>{s}</button>
          );
        })}
      </div>

      <p style={{ margin: '0 0 4px 0', fontSize: '0.72rem', color: '#777' }}>SKU: {current.sku}</p>
      {current.discount ? (
        <>
          <p style={{ margin: '0 0 2px 0', textDecoration: 'line-through', color: '#999', fontSize: '0.85rem' }}>Bs. {Number(current.price).toFixed(2)}</p>
          <p style={{ margin: '0 0 2px 0', color: '#dc3545', fontSize: '0.75rem', fontWeight: 'bold' }}>
            {current.discount.type === 'PERCENTAGE' ? `-${current.discount.value}%` : `-Bs.${current.discount.value}`} OFF
          </p>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '1.1rem', color: '#28a745' }}>Bs. {Number(current.finalPrice).toFixed(2)}</p>
        </>
      ) : (
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '1.1rem' }}>Bs. {Number(current.price).toFixed(2)}</p>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: current.available - inCartHere <= 3 ? '#b45309' : 'green', fontWeight: 'bold' }}>
          Stock: {current.available - inCartHere}
        </span>
        <button
          onClick={() => onAdd(current)}
          disabled={!canAdd}
          style={{ padding: '6px 12px', backgroundColor: canAdd ? '#007bff' : '#ccc', color: '#fff', border: 'none', borderRadius: 4, cursor: canAdd ? 'pointer' : 'not-allowed', fontSize: '0.8rem', fontWeight: 600 }}
        >
          Agregar {current.size} · {current.color}
        </button>
      </div>
    </div>
  );
};
