import { useState, useEffect } from 'react';
import { api } from '../../api/axios';

interface Supplier {
  id: number;
  name: string;
  nit: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  active: boolean;
}

export const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    id: 0,
    name: '', 
    nit: '', 
    email: '', 
    phone: '', 
    address: '', 
    active: true 
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/suppliers');
      setSuppliers(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar proveedores: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        nit: form.nit,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        active: form.active,
      };

      if (form.id) {
        await api.patch(`/suppliers/${form.id}`, payload);
      } else {
        await api.post('/suppliers', payload);
      }
      
      setForm({ id: 0, name: '', nit: '', email: '', phone: '', address: '', active: true });
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      setError('Error guardando proveedor: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (s: Supplier) => {
    setForm({
      id: s.id,
      name: s.name,
      nit: s.nit,
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || '',
      active: s.active
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar este proveedor?')) return;
    try {
      await api.delete(`/suppliers/${id}`);
      fetchData();
    } catch (err: any) {
      setError('Error eliminando proveedor: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading && suppliers.length === 0) return <div className="loading-state">Cargando proveedores...</div>;

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title">Proveedores</h1>
        <p className="page-subtitle">Administra los proveedores de productos</p>
      </div>

      <section className="content-card">
        <div className="crud-header">
          <h2>Lista de Proveedores</h2>
          <button
            className={showForm ? 'btn-secondary' : 'btn-primary'}
            onClick={() => {
              setShowForm(!showForm);
              if (!showForm) {
                setForm({ id: 0, name: '', nit: '', email: '', phone: '', address: '', active: true });
              }
            }}
          >
            {showForm ? 'Cancelar' : '+ Nuevo Proveedor'}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="crud-form">
            <div className="form-grid">
              <div className="form-group">
                <label>Nombre *</label>
                <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="form-group">
                <label>NIT *</label>
                <input type="text" required value={form.nit} onChange={e => setForm({...form, nit: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Correo Electrnico</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Telfono</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Direccin</label>
                <input type="text" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
              </div>

              <div className="form-group checkbox" style={{ gridColumn: '1 / -1' }}>
                <input type="checkbox" id="supplierActive" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
                <label htmlFor="supplierActive">Activo</label>
              </div>
            </div>
            <div className="crud-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary">{form.id ? 'Guardar Cambios' : 'Crear Proveedor'}</button>
            </div>
          </form>
        )}

        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>NIT</th>
              <th>Contacto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id}>
                <td>{s.id}</td>
                <td>{s.name}</td>
                <td>{s.nit}</td>
                <td>{s.email || '-'}<br/><small>{s.phone}</small></td>
                <td>
                  <span className={s.active ? 'badge-active' : 'badge-inactive'}>
                    {s.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="crud-actions">
                    <button className="btn-secondary" onClick={() => handleEdit(s)}>Editar</button>
                    <button className="btn-danger" onClick={() => handleDelete(s.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan={6}><div className="empty-state">No hay proveedores registrados.</div></td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
};
