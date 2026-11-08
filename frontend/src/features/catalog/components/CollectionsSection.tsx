import { useState, useEffect } from 'react';
import { api } from '../../../api/axios';
import { useAuth } from '../../auth/AuthContext';

interface Collection {
  id: number;
  name: string;
  seasonId: number;
  season?: { name: string };
  active: boolean;
}

export const CollectionsSection = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [seasons, setSeasons] = useState<{id: number, name: string}[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: 0, name: '', seasonId: 0, active: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');

  const fetchData = async () => {
    try {
      const [colRes, seaRes] = await Promise.all([
        api.get('/collections'),
        api.get('/seasons')
      ]);
      setCollections(colRes.data);
      setSeasons(seaRes.data);
      setError(null);
    } catch (err) {
      setError('Error al obtener colecciones');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (form.id) {
        await api.patch(`/collections/${form.id}`, payload);
      } else {
        await api.post('/collections', payload);
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
    setForm({ id: 0, name: '', seasonId: 0, active: true });
    setShowForm(false);
  };

  const handleEdit = (c: Collection) => {
    setForm({ id: c.id, name: c.name, seasonId: c.seasonId, active: c.active });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar colección?')) return;
    try {
      await api.delete(`/collections/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error al eliminar: ' + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="crud-card">
      <div className="crud-header">
        <h2>Colecciones</h2>
        {isAdmin && (
          <button className="btn-primary" onClick={() => showForm ? resetForm() : setShowForm(true)}>
            {showForm ? 'Cancelar' : '+ Nueva Colección'}
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
              <label>Temporada</label>
              <select required value={form.seasonId} onChange={e => setForm({...form, seasonId: Number(e.target.value)})}>
                <option value="">Seleccione...</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
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
            <th>Temporada</th>
            <th>Estado</th>
            {isAdmin && <th>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {collections.map(c => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td>{c.name}</td>
              <td>{c.season?.name}</td>
              <td><span className={c.active ? 'badge-active' : 'badge-inactive'}>{c.active ? 'Activo' : 'Inactivo'}</span></td>
              {isAdmin && (
                <td>
                  <div className="crud-actions" style={{ gap: '5px' }}>
                    <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleEdit(c)}>Editar</button>
                    <button className="btn-danger" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleDelete(c.id)}>Eliminar</button>
                  </div>
                </td>
              )}
            </tr>
          ))}
          {collections.length === 0 && !error && <tr><td colSpan={isAdmin ? 5 : 4}>No hay colecciones</td></tr>}
          {error && <tr><td colSpan={isAdmin ? 5 : 4} style={{ color: 'red', textAlign: 'center' }}>{error}</td></tr>}
        </tbody>
      </table>
    </div>
  );
};
