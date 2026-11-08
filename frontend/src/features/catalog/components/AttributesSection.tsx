import { useState, useEffect } from 'react';
import { api } from '../../../api/axios';

interface Attribute {
  id: number;
  name: string;
  active: boolean;
  hexCode?: string;
}

export const AttributesSection = () => {
  const [categories, setCategories] = useState<Attribute[]>([]);
  const [sizes, setSizes] = useState<Attribute[]>([]);
  const [colors, setColors] = useState<Attribute[]>([]);

  const [form, setForm] = useState({ id: 0, name: '', active: true, type: 'categories', hexCode: '' });

  const fetchData = async () => {
    try {
      const [catRes, sizeRes, colRes] = await Promise.all([
        api.get('/categories'),
        api.get('/sizes'),
        api.get('/colors')
      ]);
      setCategories(catRes.data);
      setSizes(sizeRes.data);
      setColors(colRes.data);
    } catch (err) {
      console.error('Error fetching attributes', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent, type: string) => {
    e.preventDefault();
    if (!form.name) return;

    try {
      const payload: any = { name: form.name, active: form.active };
      if (type === 'colors' && form.hexCode) {
        payload.hexCode = form.hexCode;
      }
      if (form.id) {
        await api.patch(`/${type}/${form.id}`, payload);
      } else {
        await api.post(`/${type}`, payload);
      }
      setForm({ id: 0, name: '', active: true, type, hexCode: '' });
      fetchData();
    } catch (err: any) {
      alert('Error guardando: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEdit = (item: Attribute, type: string) => {
    setForm({ id: item.id, name: item.name, active: item.active, type, hexCode: item.hexCode || '' });
  };

  const handleDelete = async (id: number, type: string) => {
    if (!confirm('Eliminar este registro?')) return;
    try {
      await api.delete(`/${type}/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error eliminando: ' + (err.response?.data?.message || err.message));
    }
  };

  const renderTable = (title: string, data: Attribute[], type: string) => (
    <div className="crud-card" style={{ marginBottom: '20px' }}>
      <h3>{title}</h3>
      <form onSubmit={(e) => handleSubmit(e, type)} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input 
          type="text" 
          required 
          placeholder="Nombre" 
          value={form.type === type ? form.name : ''} 
          onChange={e => setForm({ ...form, type, name: e.target.value })} 
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <input 
            type="checkbox" 
            checked={form.type === type ? form.active : true} 
            onChange={e => setForm({ ...form, type, active: e.target.checked })} 
          /> Activo
        </label>
        {type === 'colors' && (
          <input
            type="color"
            value={form.type === type ? form.hexCode || '#000000' : '#000000'}
            onChange={e => setForm({ ...form, type, hexCode: e.target.value })}
            style={{ width: '40px', padding: 0 }}
            title="Código de Color (Hex)"
          />
        )}
        <button type="submit" className="btn-primary">{form.type === type && form.id ? 'Guardar' : 'Crear'}</button>
        {form.type === type && form.id && (
          <button type="button" className="btn-secondary" onClick={() => setForm({ id: 0, name: '', active: true, type, hexCode: '' })}>Cancelar</button>
        )}
      </form>
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
          {data.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {type === 'colors' && item.hexCode && (
                  <div style={{ width: '15px', height: '15px', backgroundColor: item.hexCode, borderRadius: '50%', border: '1px solid #ccc' }}></div>
                )}
                {item.name}
              </td>
              <td>
                <span className={item.active ? 'badge-active' : 'badge-inactive'}>
                  {item.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="crud-actions" style={{ gap: '5px' }}>
                  <button className="btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleEdit(item, type)}>Editar</button>
                  <button className="btn-danger" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleDelete(item.id, type)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={4}>No hay registros</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="attributes-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
      {renderTable('Categoras', categories, 'categories')}
      {renderTable('Tallas', sizes, 'sizes')}
      {renderTable('Colores', colors, 'colors')}
    </div>
  );
};
