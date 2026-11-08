import { useState, useEffect } from 'react';
import { api } from '../../api/axios';

export interface City {
  id: number;
  name: string;
  active: boolean;
}

export const CitiesSection = () => {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: 0, name: '', active: true });

  const fetchCities = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cities');
      setCities(Array.isArray(res.data) ? res.data : []);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar ciudades: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCities(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.patch(`/cities/${form.id}`, { name: form.name, active: form.active });
      } else {
        await api.post('/cities', { name: form.name, active: form.active });
      }
      setForm({ id: 0, name: '', active: true });
      setIsEditing(false);
      setShowForm(false);
      fetchCities();
    } catch (err: any) {
      setError('Error guardando ciudad: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (city: City) => {
    setForm(city);
    setIsEditing(true);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta ciudad?')) return;
    try {
      await api.delete(`/cities/${id}`);
      fetchCities();
    } catch (err: any) {
      setError('Error eliminando ciudad: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading && cities.length === 0) return <div className="loading-state">Cargando ciudades...</div>;

  return (
    <section className="content-card">
      <div className="crud-header">
        <h2>Ciudades</h2>
        <button
          className={showForm ? 'btn-secondary' : 'btn-primary'}
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) {
              setForm({ id: 0, name: '', active: true });
              setIsEditing(false);
            }
          }}
        >
          {showForm ? 'Cancelar' : '+ Nueva Ciudad'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre de Ciudad</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="cityActive"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
              />
              <label htmlFor="cityActive">Activo</label>
            </div>
          </div>
          <div className="crud-actions" style={{ justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn-primary"
              style={{ backgroundColor: isEditing ? '#f39c12' : 'var(--be-success)' }}
            >
              {isEditing ? 'Actualizar Ciudad' : 'Guardar Ciudad'}
            </button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {cities.map(c => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>
                <span className={c.active ? 'badge-active' : 'badge-inactive'}>
                  {c.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="crud-actions">
                  <button className="btn-action" onClick={() => handleEdit(c)}>Editar</button>
                  <button className="btn-danger" onClick={() => handleDelete(c.id)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {cities.length === 0 && (
            <tr><td colSpan={4}><div className="empty-state">No hay ciudades registradas.</div></td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
};
