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
    <div className="crud-card">
      <h3>{title}</h3>
      <form onSubmit={(e) => handleSubmit(e, type)} className="adm-attr-form">
        <input 
          type="text" 
          required 
          placeholder="Nombre" 
          value={form.type === type ? form.name : ''} 
          onChange={e => setForm({ ...form, type, name: e.target.value })} 
        />
        <label className="adm-check">
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
            title="Código de Color (Hex)"
          />
        )}
        <button type="submit" className="btn-primary">{form.type === type && form.id ? 'Guardar' : 'Crear'}</button>
        {form.type === type && !!form.id && (
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
              <td style={{ fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                {type === 'colors' && item.hexCode && (
                  <span className="adm-color-dot" style={{ backgroundColor: item.hexCode }} />
                )}
                {item.name}
                </span>
              </td>
              <td>
                <span className={item.active ? 'badge-active' : 'badge-inactive'}>
                  {item.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              <td>
                <div className="crud-actions" style={{ gap: '5px' }}>
                  <button className="btn-secondary" onClick={() => handleEdit(item, type)}>Editar</button>
                  <button className="btn-danger" onClick={() => handleDelete(item.id, type)}>Eliminar</button>
                </div>
              </td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={4} className="empty-state">Aún no hay registros. Crea el primero arriba.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="adm-attrs">
      {renderTable('Categorías', categories, 'categories')}
      {renderTable('Tallas', sizes, 'sizes')}
      {renderTable('Colores', colors, 'colors')}
    </div>
  );
};
