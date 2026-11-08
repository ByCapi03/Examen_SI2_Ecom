import { useState, useEffect } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import { ROL } from '../../types/roles';
import type { City } from '../branches/CitiesSection'; // For type or just any

interface Branch {
  id: number;
  name: string;
  cityId: number;
  active: boolean;
  city?: City;
}

interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
  branchId: number | null;
  branch?: Branch;
  userRoles: { role: { name: string } }[];
}

export const UsersPage = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ 
    name: '', 
    email: '', 
    roleName: '', 
    branchId: 0, 
    active: true 
  });

  const isAdmin = currentUser?.roles.includes(ROL.ADMIN);
  const isEncargado = currentUser?.roles.includes(ROL.ENCARGADO);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, branchesRes] = await Promise.all([
        api.get('/users'),
        api.get('/branches'),
      ]);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
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
      const payload: any = {
        name: form.name,
        email: form.email,
        active: form.active,
      };

      if (isAdmin) {
        payload.roleName = form.roleName;
        if (form.roleName === ROL.ENCARGADO || form.roleName === ROL.CAJERO) {
          payload.branchId = Number(form.branchId);
        }
      } else if (isEncargado) {
        payload.roleName = ROL.CAJERO;
        payload.branchId = currentUser?.branchId;
      }

      await api.post('/users', payload);
      setForm({ name: '', email: '', roleName: '', branchId: 0, active: true });
      setShowForm(false);
      fetchData();
      alert('Usuario creado correctamente. Se envi una contrasea temporal por correo.');
    } catch (err: any) {
      setError('Error guardando usuario: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleResendPassword = async (id: number) => {
    try {
      await api.post(`/users/${id}/resend-temporary-password`);
      alert('Contrasea temporal reenviada por correo.');
    } catch (err: any) {
      setError('Error reenviando contrasea: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Eliminar este usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchData();
    } catch (err: any) {
      setError('Error eliminando usuario: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading && users.length === 0) return <div className="loading-state">Cargando usuarios...</div>;

  return (
    <section className="content-card">
      <div className="crud-header">
        <h2>Usuarios</h2>
        <button
          className={showForm ? 'btn-secondary' : 'btn-primary'}
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) {
              setForm({ name: '', email: '', roleName: isEncargado ? 'CAJERO' : '', branchId: isEncargado ? (currentUser?.branchId || 0) : 0, active: true });
            }
          }}
        >
          {showForm ? 'Cancelar' : (isEncargado ? '+ Nuevo Cajero' : '+ Nuevo Usuario')}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} className="crud-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Correo</label>
              <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>

            {isAdmin && (
              <div className="form-group">
                <label>Rol</label>
                <select required value={form.roleName} onChange={e => setForm({...form, roleName: e.target.value})}>
                  <option value="" disabled>Selecciona un rol</option>
                  <option value={ROL.ADMIN}>Administrador</option>
                  <option value={ROL.ENCARGADO}>Encargado</option>
                  <option value={ROL.CAJERO}>Cajero</option>
                </select>
              </div>
            )}

            {isEncargado && (
              <div className="form-group">
                <label>Rol</label>
                <input type="text" disabled value="Cajero" />
              </div>
            )}

            {isEncargado && (
              <div className="form-group">
                <label>Sucursal</label>
                <input type="text" disabled value={branches.find(b => b.id === currentUser?.branchId)?.name || 'Tu Sucursal'} />
              </div>
            )}

            {isAdmin && (form.roleName === ROL.ENCARGADO || form.roleName === ROL.CAJERO) && (
              <div className="form-group">
                <label>Sucursal</label>
                <select required value={form.branchId} onChange={e => setForm({...form, branchId: Number(e.target.value)})}>
                  <option value="0" disabled>Selecciona una sucursal</option>
                  {branches.filter(b => b.active).map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group checkbox" style={{ gridColumn: '1 / -1' }}>
              <input type="checkbox" id="userActive" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} />
              <label htmlFor="userActive">Activo</label>
            </div>
          </div>
          <div className="crud-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary">Guardar Usuario</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Rol</th>
            <th>Sucursal</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const roleStr = u.userRoles?.map(ur => ur.role.name).join(', ') || 'N/A';
            return (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{roleStr}</td>
                <td>{u.branch?.name || '-'}</td>
                <td>
                  <span className={u.active ? 'badge-active' : 'badge-inactive'}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="crud-actions">
                    <button className="btn-secondary" onClick={() => handleResendPassword(u.id)}>Reenviar Acceso</button>
                    <button className="btn-danger" onClick={() => handleDelete(u.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            );
          })}
          {users.length === 0 && (
            <tr><td colSpan={6}><div className="empty-state">No hay usuarios.</div></td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
};
