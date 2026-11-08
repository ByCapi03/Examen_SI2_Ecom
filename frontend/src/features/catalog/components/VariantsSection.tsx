import { useState, useEffect } from 'react';
import { api } from '../../../api/axios';

interface Variant {
  id: number;
  sku: string;
  productId: number;
  sizeId: number;
  colorId: number;
  active: boolean;
  product?: { name: string };
  size?: { name: string };
  color?: { name: string };
}

export const VariantsSection = () => {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [products, setProducts] = useState<{id: number, name: string}[]>([]);
  const [sizes, setSizes] = useState<{id: number, name: string}[]>([]);
  const [colors, setColors] = useState<{id: number, name: string}[]>([]);
  
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: 0, sku: '', productId: 0, sizeId: 0, colorId: 0, active: true });

  const fetchData = async () => {
    try {
      const [varRes, prodRes, sizeRes, colRes] = await Promise.all([
        api.get('/variants'),
        api.get('/products'),
        api.get('/sizes'),
        api.get('/colors')
      ]);
      setVariants(varRes.data);
      setProducts(prodRes.data);
      setSizes(sizeRes.data);
      setColors(colRes.data);
    } catch (err) {
      console.error('Error fetching data', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        sku: form.sku,
        productId: Number(form.productId),
        sizeId: Number(form.sizeId),
        colorId: Number(form.colorId),
        active: form.active
      };
      if (form.id) {
        await api.patch(`/variants/${form.id}`, payload);
      } else {
        await api.post('/variants', payload);
      }
      setForm({ id: 0, sku: '', productId: 0, sizeId: 0, colorId: 0, active: true });
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      alert('Error guardando variante: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar variante?')) return;
    try {
      await api.delete(`/variants/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error eliminando: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="crud-card">
      <div className="crud-header">
        <h2>Variantes</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setForm({ id: 0, sku: '', productId: 0, sizeId: 0, colorId: 0, active: true }); }}>
          {showForm ? 'Cancelar' : '+ Nueva Variante'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="crud-form" style={{ marginBottom: '20px' }}>
          <div className="form-grid">
            <div className="form-group">
              <label>SKU</label>
              <input type="text" required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Producto</label>
              <select required value={form.productId} onChange={e => setForm({...form, productId: Number(e.target.value)})}>
                <option value="">Seleccione...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Talla</label>
              <select required value={form.sizeId} onChange={e => setForm({...form, sizeId: Number(e.target.value)})}>
                <option value="">Seleccione...</option>
                {sizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Color</label>
              <select required value={form.colorId} onChange={e => setForm({...form, colorId: Number(e.target.value)})}>
                <option value="">Seleccione...</option>
                {colors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group checkbox" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
              <label>Activo</label>
            </div>
          </div>
          <button type="submit" className="btn-primary">{form.id ? 'Guardar' : 'Crear'}</button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>SKU</th>
            <th>Producto</th>
            <th>Talla</th>
            <th>Color</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {variants.map(v => (
            <tr key={v.id}>
              <td>{v.id}</td>
              <td>{v.sku}</td>
              <td>{v.product?.name}</td>
              <td>{v.size?.name}</td>
              <td>{v.color?.name}</td>
              <td><span className={v.active ? 'badge-active' : 'badge-inactive'}>{v.active ? 'Activo' : 'Inactivo'}</span></td>
              <td>
                <div className="crud-actions" style={{ gap: '5px' }}>
                  <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => { setForm({ id: v.id, sku: v.sku, productId: v.productId, sizeId: v.sizeId, colorId: v.colorId, active: v.active }); setShowForm(true); }}>Editar</button>
                  <button className="btn-danger" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleDelete(v.id)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {variants.length === 0 && <tr><td colSpan={7}>No hay variantes</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
