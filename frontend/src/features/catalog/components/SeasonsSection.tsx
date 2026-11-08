import { useState, useEffect } from 'react';
import { api } from '../../../api/axios';
import { useAuth } from '../../auth/AuthContext';

interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export const SeasonsSection = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: 0, name: '', startDate: '', endDate: '', active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');

  const fetchData = async () => {
    try {
      const res = await api.get('/seasons');
      setSeasons(res.data);
      setError(null);
    } catch (err) {
      setError('Error al obtener temporadas');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.id) {
        await api.patch(`/seasons/${form.id}`, payload);
      } else {
        await api.post('/seasons', payload);
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
    setForm({ id: 0, name: '', startDate: '', endDate: '', active: true });
    setShowForm(false);
  };

  const handleEdit = (s: Season) => {
    setForm({ id: s.id, name: s.name, startDate: s.startDate, endDate: s.endDate, active: s.active });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar temporada?')) return;
    try {
      await api.delete(`/seasons/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="crud-card">
      <div className="crud-header">
        <h2>Temporadas</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => showForm ? resetForm() : setShowForm(true)}>
            {showForm ? 'Cancelar' : '+ Nueva Temporada'}
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
              <label>Fecha Inicio</label>
              <input type="date" required value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Fecha Fin</label>
              <input type="date" required value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
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
            <th>Inicio</th>
            <th>Fin</th>
            <th>Estado</th>
            {isAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {seasons.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.name}</td>
              <td>{s.startDate}</td>
              <td>{s.endDate}</td>
              <td><span className={s.active ? 'badge-active' : 'badge-inactive'}>{s.active ? 'Activo' : 'Inactivo'}</span></td>
              {isAdmin && (
                <td>
                  <div className="crud-actions" style={{ gap: '5px' }}>
                    <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleEdit(s)}>Editar</button>
                    <button className="btn-danger" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleDelete(s.id)}>Eliminar</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {seasons.length === 0 && !error && <tr><td colSpan={isAdmin ? 6 : 5}>No hay temporadas</td></tr>}
          {error && <tr><td colSpan={isAdmin ? 6 : 5} style={{ color: 'red', textAlign: 'center' }}>{error}</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
