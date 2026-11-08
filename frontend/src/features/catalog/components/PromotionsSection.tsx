import { useState, useEffect } from 'react';
import { api } from '../../../api/axios';
import { useAuth } from '../../auth/AuthContext';

interface Promotion {
  id: number;
  name: string;
  type: 'PERCENTAGE' | 'FIXED';
  value: string;
  startDate: string;
  endDate: string;
  active: boolean;
  products?: { id: number, name: string }[];
}

export const PromotionsSection = () => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<{id: number, name: string}[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: 0, name: '', type: 'PERCENTAGE', value: '', startDate: '', endDate: '', active: true, productIds: [] as number[] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');

  const fetchData = async () => {
    try {
      const [promRes, prodRes] = await Promise.all([
        api.get('/promotions'),
        api.get('/products')
      ]);
      setPromotions(promRes.data);
      setProducts(prodRes.data);
      setError(null);
    } catch (err) {
      setError('Error al obtener promociones');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { 
        ...form, 
        value: parseFloat(form.value)
      };
      if (form.id) {
        await api.patch(`/promotions/${form.id}`, payload);
      } else {
        await api.post('/promotions', payload);
      }
      resetForm();
      fetchData();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ id: 0, name: '', type: 'PERCENTAGE', value: '', startDate: '', endDate: '', active: true, productIds: [] });
    setShowForm(false);
  };

  const handleEdit = (p: Promotion) => {
    setForm({ 
      id: p.id, 
      name: p.name, 
      type: p.type, 
      value: String(p.value), 
      startDate: p.startDate, 
      endDate: p.endDate, 
      active: p.active, 
      productIds: p.products?.map(prod => prod.id) || [] 
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar promoción?')) return;
    try {
      await api.delete(`/promotions/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="crud-card">
      <div className="crud-header">
        <h2>Promociones</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => showForm ? resetForm() : setShowForm(true)}>
            {showForm ? 'Cancelar' : '+ Nueva Promoción'}
          </button>
        )}
      </div>

      {showForm && isAdmin && (
        <form onSubmit={handleSubmit} className="crud-form" style={{ marginBottom: '20px' }}>
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Tipo</label>
              <select required value={form.type} onChange={e => setForm({...form, type: e.target.value as any})}>
                <option value="PERCENTAGE">Porcentaje (%)</option>
                <option value="FIXED">Monto Fijo (Bs.)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Valor Descuento</label>
              <input type="number" step="0.01" required value={form.value} onChange={e => setForm({...form, value: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Fecha Inicio</label>
              <input type="date" required value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Fecha Fin</label>
              <input type="date" required value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Productos (Múltiple Selección)</label>
              <select multiple value={form.productIds.map(String)} onChange={e => {
                const options = Array.from(e.target.options);
                const selected = options.filter(o => o.selected).map(o => Number(o.value));
                setForm({...form, productIds: selected});
              }} style={{ height: '100px' }}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <small>Mantén pulsado Ctrl/Cmd para seleccionar varios</small>
            </div>
            <div className="form-group checkbox" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
              <label>Activo</label>
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : (form.id ? 'Guardar' : 'Crear')}
          </button>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Descuento</th>
            <th>Vigencia</th>
            <th>Estado</th>
            {isAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {promotions.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.type === 'PERCENTAGE' ? `${p.value}%` : `Bs. ${p.value}`}</td>
              <td>{p.startDate} - {p.endDate}</td>
              <td><span className={p.active ? 'badge-active' : 'badge-inactive'}>{p.active ? 'Activo' : 'Inactivo'}</span></td>
              {isAdmin && (
                <td>
                  <div className="crud-actions" style={{ gap: '5px' }}>
                    <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleEdit(p)}>Editar</button>
                    <button className="btn-danger" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleDelete(p.id)}>Eliminar</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {promotions.length === 0 && !error && <tr><td colSpan={isAdmin ? 6 : 5}>No hay promociones</td></tr>}
          {error && <tr><td colSpan={isAdmin ? 6 : 5} style={{ color: 'red', textAlign: 'center' }}>{error}</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
