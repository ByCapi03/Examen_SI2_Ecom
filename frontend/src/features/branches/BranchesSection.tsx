import { useState, useEffect } from 'react';
import { api } from '../../api/axios';

interface City {
  id: number;
  name: string;
  active: boolean;
}

interface Branch {
  id: number;
  name: string;
  address: string;
  phone: string;
  cityId: number;
  active: boolean;
  city?: City;
}

export const BranchesSection = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: 0, name: '', address: '', phone: '', cityId: 0, active: true });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [citiesRes, branchesRes] = await Promise.all([
        api.get('/cities'),
        api.get('/branches'),
      ]);
      setCities(Array.isArray(citiesRes.data) ? citiesRes.data : []);
      setBranches(Array.isArray(branchesRes.data) ? branchesRes.data : []);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar datos: ' + (err.response?.data?.message || err.message));
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
        address: form.address,
        phone: form.phone,
        cityId: Number(form.cityId),
        active: form.active,
      };
      if (isEditing) {
        await api.patch(`/branches/${form.id}`, payload);
      } else {
        await api.post('/branches', payload);
      }
      setForm({ id: 0, name: '', address: '', phone: '', cityId: 0, active: true });
      setIsEditing(false);
      setShowForm(false);
      fetchData();
    } catch (err: any) {
      setError('Error guardando sucursal: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (branch: Branch) => {
    setForm(branch);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta sucursal?')) return;
    try {
      await api.delete(`/branches/${id}`);
      fetchData();
    } catch (err: any) {
      setError('Error eliminando sucursal: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading && branches.length === 0) return <div className="loading-state">Cargando sucursales...</div>;

  return (
    <section className="content-card">
      <div className="crud-header">
        <h2>Sucursales</h2>
        <button
          className={showForm ? 'btn-secondary' : 'btn-primary'}
          disabled={cities.length === 0}
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) {
              setForm({ id: 0, name: '', address: '', phone: '', cityId: 0, active: true });
              setIsEditing(false);
            }
          }}
        >
          {showForm ? 'Cancelar' : '+ Nueva Sucursal'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {cities.length === 0 && (
        <div className="warning-message">
          <strong>Aviso:</strong> Debe registrar una ciudad antes de crear una sucursal.
        </div>
      )}

      {showForm && cities.length > 0 && (
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Dirección</label>
              <input
                type="text"
                required
                value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input
                type="text"
                required
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Ciudad</label>
              <select
                required
                value={form.cityId}
                onChange={e => setForm({ ...form, cityId: Number(e.target.value) })}
              >
                <option value="0" disabled>Selecciona una ciudad</option>
                {cities.filter(c => c.active).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group checkbox" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                id="branchActive"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
              />
              <label htmlFor="branchActive">Activo</label>
            </div>
          </div>
          <div className="crud-actions" style={{ justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ backgroundColor: isEditing ? '#f39c12' : 'var(--be-success)' }}
            >
              {isEditing ? 'Actualizar Sucursal' : 'Guardar Sucursal'}
            </button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Ciudad</th>
            <th>Dirección</th>
            <th>Teléfono</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {branches.map(b => (
            <tr key={b.id}>
              <td>{b.name}</td>
              <td>{b.city?.name || cities.find(c => c.id === b.cityId)?.name || b.cityId}</td>
              <td>{b.address}</td>
              <td>{b.phone}</td>
              <td>
                <span className={b.active ? 'badge-active' : 'badge-inactive'}>
                  {b.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="crud-actions">
                  <button className="btn-action" onClick={() => handleEdit(b)}>Editar</button>
                  <button className="btn-danger" onClick={() => handleDelete(b.id)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {branches.length === 0 && (
            <tr><td colSpan={6}><div className="empty-state">No hay sucursales registradas.</div></td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
};
