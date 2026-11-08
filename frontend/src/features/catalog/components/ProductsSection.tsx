import { useState, useEffect } from 'react';
import { api } from '../../../api/axios';

interface Product {
  id: number;
  name: string;
  price: number;
  active: boolean;
  categoryId: number;
  collectionId?: number;
  imageUrl?: string;
  colorizable?: boolean;
  sourceColor?: string;
  arEnabled?: boolean;
  arImageUrl?: string;
  arTorsoUrl?: string;
  arLeftSleeveUrl?: string;
  arRightSleeveUrl?: string;
  arType?: 'TOP' | 'BOTTOM' | 'DRESS' | null;
  category?: { name: string };
  collection?: { name: string, season?: { name: string } };
  basePrice?: number;
  finalPrice?: number;
  discount?: { type: string, value: number, amount: number } | null;
  winningPromotion?: { name: string } | null;
}

export const ProductsSection = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: number, name: string }[]>([]);
  const [collections, setCollections] = useState<{ id: number, name: string, season?: { name: string } }[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ id: 0, name: '', price: '', categoryId: 0, collectionId: '', active: true, colorizable: false, sourceColor: '', arEnabled: false, arType: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedArFile, setSelectedArFile] = useState<File | null>(null);
  const [previewArUrl, setPreviewArUrl] = useState<string | null>(null);

  const [arMode, setArMode] = useState<'RIGID' | 'ARTICULATED'>('RIGID');
  const [selectedTorsoFile, setSelectedTorsoFile] = useState<File | null>(null);
  const [previewTorsoUrl, setPreviewTorsoUrl] = useState<string | null>(null);
  const [selectedLeftSleeveFile, setSelectedLeftSleeveFile] = useState<File | null>(null);
  const [previewLeftSleeveUrl, setPreviewLeftSleeveUrl] = useState<string | null>(null);
  const [selectedRightSleeveFile, setSelectedRightSleeveFile] = useState<File | null>(null);
  const [previewRightSleeveUrl, setPreviewRightSleeveUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Action Menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [prodRes, catRes, colRes] = await Promise.all([
        api.get('/products'),
        api.get('/categories'),
        api.get('/collections').catch(() => ({ data: [] }))
      ]);
      setProducts(prodRes.data);
      setCategories(catRes.data);
      setCollections(colRes.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching data', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Formato de imagen no permitido');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo no debe superar los 5MB');
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadImage = async (productId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    await api.post(`/products/${productId}/image`, formData);
  };

  const handleArFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        alert('Formato de imagen AR no permitido');
        return;
      }
      setSelectedArFile(file);
      setPreviewArUrl(URL.createObjectURL(file));
    }
  };

  const uploadArImage = async (productId: number, file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    await api.post(`/products/${productId}/ar-image`, formData);
  };

  const uploadArPart = async (productId: number, file: File, part: 'torso' | 'left-sleeve' | 'right-sleeve') => {
    const formData = new FormData();
    formData.append('image', file);
    await api.post(`/products/${productId}/ar-${part}`, formData);
  };

  const deleteArPart = async (productId: number, part: 'rigid' | 'torso' | 'leftSleeve' | 'rightSleeve') => {
    await api.delete(`/products/${productId}/ar-part/${part}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        price: parseFloat(form.price),
        categoryId: Number(form.categoryId),
        collectionId: form.collectionId ? Number(form.collectionId) : null,
        active: form.active,
        colorizable: form.colorizable,
        sourceColor: form.colorizable ? form.sourceColor : null,
        arEnabled: form.arEnabled,
        arType: form.arEnabled ? (form.arType || null) : null
      };

      let productId = form.id;
      if (productId) {
        await api.patch(`/products/${productId}`, payload);
      } else {
        const res = await api.post('/products', payload);
        productId = res.data.id;
      }

      if (selectedFile && productId) {
        try {
          await uploadImage(productId, selectedFile);
        } catch (imgErr: any) {
          alert('El producto se guardó pero hubo un error al subir la imagen: ' + (imgErr.response?.data?.message || imgErr.message));
        }
      }

      if (arMode === 'RIGID' && selectedArFile && productId) {
        try {
          await uploadArImage(productId, selectedArFile);
        } catch (imgErr: any) {
          alert('Error al subir la imagen AR: ' + (imgErr.response?.data?.message || imgErr.message));
        }
      }

      if (arMode === 'ARTICULATED' && productId) {
        try {
          if (selectedTorsoFile) await uploadArPart(productId, selectedTorsoFile, 'torso');
          if (selectedLeftSleeveFile) await uploadArPart(productId, selectedLeftSleeveFile, 'left-sleeve');
          if (selectedRightSleeveFile) await uploadArPart(productId, selectedRightSleeveFile, 'right-sleeve');
        } catch (imgErr: any) {
          alert('Error al subir piezas AR: ' + (imgErr.response?.data?.message || imgErr.message));
        }
      }

      resetForm();
      fetchData();
    } catch (err: any) {
      alert('Error guardando producto: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ id: 0, name: '', price: '', categoryId: 0, collectionId: '', active: true, colorizable: false, sourceColor: '', arEnabled: false, arType: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedArFile(null);
    setPreviewArUrl(null);
    setArMode('RIGID');
    setSelectedTorsoFile(null);
    setPreviewTorsoUrl(null);
    setSelectedLeftSleeveFile(null);
    setPreviewLeftSleeveUrl(null);
    setSelectedRightSleeveFile(null);
    setPreviewRightSleeveUrl(null);
    setShowForm(false);
  };

  const handleEdit = (p: Product) => {
    setForm({
      id: p.id,
      name: p.name,
      price: String(p.price),
      categoryId: p.categoryId,
      collectionId: p.collectionId ? String(p.collectionId) : '',
      active: p.active,
      colorizable: p.colorizable || false,
      sourceColor: p.sourceColor || '',
      arEnabled: p.arEnabled || false,
      arType: p.arType || ''
    });
    setSelectedFile(null);
    setPreviewUrl(p.imageUrl || null);
    setSelectedArFile(null);
    setPreviewArUrl(p.arImageUrl || null);
    setSelectedTorsoFile(null);
    setPreviewTorsoUrl(p.arTorsoUrl || null);
    setSelectedLeftSleeveFile(null);
    setPreviewLeftSleeveUrl(p.arLeftSleeveUrl || null);
    setSelectedRightSleeveFile(null);
    setPreviewRightSleeveUrl(p.arRightSleeveUrl || null);

    if (p.arTorsoUrl && p.arLeftSleeveUrl && p.arRightSleeveUrl) {
      setArMode('ARTICULATED');
    } else {
      setArMode('RIGID');
    }

    setShowForm(true);
    setOpenMenuId(null);
  };

  const handleDelete = async (id: number) => {
    setOpenMenuId(null);
    if (!confirm('¿Estás seguro de que deseas eliminar este producto?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch (err: any) {
      alert('Error eliminando: ' + (err.response?.data?.message || err.message));
    }
  };

  // Unique seasons from collections
  const uniqueSeasons = Array.from(new Set(collections.map(c => c.season?.name).filter(Boolean)));

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.id.toString().includes(searchTerm);
    const matchesCategory = filterCategory ? p.categoryId.toString() === filterCategory : true;
    const matchesSeason = filterSeason ? p.collection?.season?.name === filterSeason : true;
    const matchesStatus = filterStatus === 'active' ? p.active : filterStatus === 'inactive' ? !p.active : true;
    return matchesSearch && matchesCategory && matchesSeason && matchesStatus;
  });

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '30px' }}>
        <div>
          <h2 style={{ fontSize: '2rem', color: 'var(--atemporal-green)', margin: '0 0 5px 0' }}>PRODUCTOS</h2>
          <p style={{ color: 'var(--atemporal-muted)', margin: 0, fontSize: '1rem' }}>
            Gestiona catálogo, variantes, colecciones y funciones AR.
          </p>
        </div>
      </div>

      {/* TOP FILTERS & ACTION */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', flex: 1 }}>
          <input
            type="text"
            placeholder="Buscar producto..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', minWidth: '200px', outline: 'none' }}
          />
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            style={{ padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
          >
            <option value="">Categoría ▼</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={filterSeason}
            onChange={e => setFilterSeason(e.target.value)}
            style={{ padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
          >
            <option value="">Temporada ▼</option>
            {uniqueSeasons.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '10px 15px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}
          >
            <option value="">Estado ▼</option>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ padding: '10px 20px', backgroundColor: 'var(--atemporal-green)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            + Nuevo producto
          </button>
        )}
      </div>

      {/* EXPANDABLE FORM CARD */}
      {showForm && (
        <div style={{ backgroundColor: 'white', border: '1px solid #eaeaea', borderRadius: '12px', padding: '30px', marginBottom: '40px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          <h3 style={{ margin: '0 0 25px 0', fontSize: '1.5rem', color: 'var(--atemporal-green-dark)', borderBottom: '1px solid #eaeaea', paddingBottom: '15px' }}>
            {form.id ? 'Editar Producto' : 'Crear Producto'}
          </h3>
          <form onSubmit={handleSubmit}>

            {/* INFORMACIÓN GENERAL */}
            <h4 style={{ marginBottom: '15px', color: 'var(--atemporal-muted)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px' }}>Información General</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Nombre</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Categoría</label>
                <select required value={form.categoryId} onChange={e => setForm({ ...form, categoryId: Number(e.target.value) })} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}>
                  <option value="">Seleccione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Colección / Temporada</label>
                <select value={form.collectionId} onChange={e => setForm({ ...form, collectionId: e.target.value })} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}>
                  <option value="">Ninguna</option>
                  {collections.map(c => <option key={c.id} value={c.id}>{c.name} {c.season ? `(${c.season.name})` : ''}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Precio Base (Bs.)</label>
                <input type="number" step="0.01" required value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Imagen Principal</label>
                <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleFileChange} style={{ fontSize: '0.85rem' }} />
                {previewUrl && <img src={previewUrl} alt="Preview" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '6px', marginTop: '10px' }} />}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', marginTop: '15px' }}>
                <input type="checkbox" id="activeCb" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: '18px', height: '18px', marginRight: '10px', accentColor: 'var(--atemporal-green)' }} />
                <label htmlFor="activeCb" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Producto Activo</label>
              </div>
            </div>

            {/* VARIANTES / COLOR */}
            <h4 style={{ marginBottom: '15px', color: 'var(--atemporal-muted)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', borderTop: '1px solid #eaeaea', paddingTop: '20px' }}>Variantes / Color</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input type="checkbox" id="colorizableCb" checked={form.colorizable} onChange={e => setForm({ ...form, colorizable: e.target.checked })} style={{ width: '18px', height: '18px', marginRight: '10px', accentColor: 'var(--atemporal-green)' }} />
                <label htmlFor="colorizableCb" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Habilitar Generación Dinámica por Color</label>
              </div>
              {form.colorizable && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Color Base Original de la Imagen</label>
                  <input type="color" value={form.sourceColor || '#000000'} onChange={e => setForm({ ...form, sourceColor: e.target.value })} style={{ width: '50px', height: '40px', padding: '0', border: 'none', borderRadius: '6px', cursor: 'pointer' }} title="Seleccionar color original" />
                </div>
              )}
            </div>

            {/* REALIDAD AUMENTADA */}
            <h4 style={{ marginBottom: '15px', color: 'var(--atemporal-muted)', textTransform: 'uppercase', fontSize: '0.85rem', letterSpacing: '1px', borderTop: '1px solid #eaeaea', paddingTop: '20px' }}>Realidad Aumentada</h4>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <input type="checkbox" id="arCb" checked={form.arEnabled} onChange={e => setForm({ ...form, arEnabled: e.target.checked })} style={{ width: '18px', height: '18px', marginRight: '10px', accentColor: 'var(--atemporal-green)' }} />
              <label htmlFor="arCb" style={{ fontWeight: '500', fontSize: '0.95rem' }}>Habilitar Vestidor Virtual (AR)</label>
            </div>

            {form.arEnabled && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '30px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Tipo de Prenda AR</label>
                    <select required value={form.arType} onChange={e => setForm({ ...form, arType: e.target.value })} style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: 'white', outline: 'none' }}>
                      <option value="">Seleccione...</option>
                      <option value="TOP">Superior (Poleras, Camisas)</option>
                      <option value="BOTTOM">Inferior (Pantalones, Faldas)</option>
                      <option value="DRESS">Vestidos (Cuerpo Entero)</option>
                    </select>
                  </div>
                  
                  {form.arType === 'TOP' && (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Modo de vestidor</label>
                      <div style={{ display: 'flex', gap: '20px', marginTop: '10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="radio" checked={arMode === 'RIGID'} onChange={() => setArMode('RIGID')} style={{ marginRight: '8px' }} />
                          Imagen rígida
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="radio" checked={arMode === 'ARTICULATED'} onChange={() => setArMode('ARTICULATED')} style={{ marginRight: '8px' }} />
                          Prenda articulada
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {arMode === 'RIGID' || form.arType !== 'TOP' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '15px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db' }}>
                    <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Imagen especial para AR (Completa)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleArFileChange} style={{ fontSize: '0.85rem' }} />
                      {form.id !== 0 && previewArUrl && (
                        <button type="button" onClick={async () => {
                          if (confirm('¿Eliminar imagen AR rígida?')) {
                            await deleteArPart(form.id, 'rigid');
                            setPreviewArUrl(null);
                          }
                        }} style={{ fontSize: '0.8rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Eliminar</button>
                      )}
                    </div>
                    {previewArUrl ? (
                      <img src={previewArUrl} alt="Preview AR" style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '6px', marginTop: '10px', backgroundColor: '#fff', border: '1px solid #eee' }} />
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#666', marginTop: '8px' }}>Si se omite, se usará la imagen principal del producto.</span>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', padding: '15px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px dashed #86efac' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Torso (PNG sin fondo)</label>
                      <input type="file" accept="image/png, image/webp" onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedTorsoFile(e.target.files[0]);
                          setPreviewTorsoUrl(URL.createObjectURL(e.target.files[0]));
                        }
                      }} style={{ fontSize: '0.8rem', marginBottom: '10px' }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        {previewTorsoUrl && <img src={previewTorsoUrl} alt="Torso" style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ccc' }} />}
                        {form.id !== 0 && previewTorsoUrl && (
                          <button type="button" onClick={async () => {
                            if (confirm('¿Eliminar torso?')) { await deleteArPart(form.id, 'torso'); setPreviewTorsoUrl(null); }
                          }} style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Manga Izquierda</label>
                      <input type="file" accept="image/png, image/webp" onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedLeftSleeveFile(e.target.files[0]);
                          setPreviewLeftSleeveUrl(URL.createObjectURL(e.target.files[0]));
                        }
                      }} style={{ fontSize: '0.8rem', marginBottom: '10px' }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        {previewLeftSleeveUrl && <img src={previewLeftSleeveUrl} alt="Left Sleeve" style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ccc' }} />}
                        {form.id !== 0 && previewLeftSleeveUrl && (
                          <button type="button" onClick={async () => {
                            if (confirm('¿Eliminar manga izquierda?')) { await deleteArPart(form.id, 'leftSleeve'); setPreviewLeftSleeveUrl(null); }
                          }} style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ marginBottom: '5px', fontWeight: '500', fontSize: '0.9rem' }}>Manga Derecha</label>
                      <input type="file" accept="image/png, image/webp" onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedRightSleeveFile(e.target.files[0]);
                          setPreviewRightSleeveUrl(URL.createObjectURL(e.target.files[0]));
                        }
                      }} style={{ fontSize: '0.8rem', marginBottom: '10px' }} />
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                        {previewRightSleeveUrl && <img src={previewRightSleeveUrl} alt="Right Sleeve" style={{ width: '60px', height: '60px', objectFit: 'contain', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ccc' }} />}
                        {form.id !== 0 && previewRightSleeveUrl && (
                          <button type="button" onClick={async () => {
                            if (confirm('¿Eliminar manga derecha?')) { await deleteArPart(form.id, 'rightSleeve'); setPreviewRightSleeveUrl(null); }
                          }} style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Borrar</button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BOTONES */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', borderTop: '1px solid #eaeaea', paddingTop: '20px' }}>
              <button type="button" onClick={resetForm} style={{ padding: '12px 25px', backgroundColor: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} style={{ padding: '12px 25px', backgroundColor: 'var(--atemporal-green)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Guardando...' : (form.id ? 'Guardar cambios' : 'Crear producto')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABLE / LISTADO */}
      <div style={{ backgroundColor: 'white', border: '1px solid #eaeaea', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #eaeaea' }}>
              <th style={{ padding: '15px 20px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Producto</th>
              <th style={{ padding: '15px 20px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Precio</th>
              <th style={{ padding: '15px 20px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Colección / Temporada</th>
              <th style={{ padding: '15px 20px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AR</th>
              <th style={{ padding: '15px 20px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estado</th>
              <th style={{ padding: '15px 20px', fontSize: '0.85rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #eaeaea', transition: 'background-color 0.2s' }}>
                <td data-label="Producto" style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} style={{ width: '56px', height: '72px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #eee' }} />
                    ) : (
                      <div style={{ width: '56px', height: '72px', backgroundColor: '#f0f0f0', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '12px' }}>N/A</div>
                    )}
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'var(--atemporal-text)', marginBottom: '2px' }}>{p.name}</div>
                      <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '2px' }}>#{p.id}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--atemporal-green)', fontWeight: '500' }}>{p.category?.name}</div>
                    </div>
                  </div>
                </td>
                <td data-label="Precio" style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {p.discount ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.85rem', color: '#999', textDecoration: 'line-through' }}>Bs. {p.basePrice?.toFixed(2)}</span>
                          <span style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            -{p.discount.type === 'PERCENTAGE' ? `${p.discount.value}%` : `Bs.${p.discount.value}`}
                          </span>
                        </div>
                        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#dc2626' }}>Bs. {p.finalPrice?.toFixed(2)}</span>
                        <span style={{ fontSize: '0.75rem', color: '#888' }}>{p.winningPromotion?.name}</span>
                      </>
                    ) : (
                      <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--atemporal-text)' }}>Bs. {Number(p.price).toFixed(2)}</span>
                    )}
                  </div>
                </td>
                <td data-label="Colección / Temporada" style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                    {p.collection?.season && (
                      <span style={{ backgroundColor: '#f3f4f6', color: '#4b5563', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>
                        {p.collection.season.name}
                      </span>
                    )}
                    {p.collection && (
                      <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem' }}>
                        {p.collection.name}
                      </span>
                    )}
                    {!p.collection?.season && !p.collection && <span style={{ color: '#aaa', fontSize: '0.85rem' }}>—</span>}
                  </div>
                </td>
                <td data-label="AR" style={{ padding: '15px 20px' }}>
                  {p.arEnabled && p.arType ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: '500' }}>
                      {p.arType}
                    </span>
                  ) : (
                    <span style={{ color: '#aaa', fontSize: '0.85rem' }}>—</span>
                  )}
                </td>
                <td data-label="Estado" style={{ padding: '15px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.active ? '#10b981' : '#9ca3af' }}></div>
                    <span style={{ fontSize: '0.85rem', color: p.active ? '#065f46' : '#4b5563', fontWeight: '500' }}>
                      {p.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </td>
                <td data-label="Acciones" style={{ padding: '15px 20px', position: 'relative', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button onClick={() => handleEdit(p)} style={{ padding: '6px 12px', backgroundColor: 'var(--atemporal-cream)', color: 'var(--atemporal-green)', border: '1px solid var(--atemporal-green)', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                      Editar
                    </button>
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)} style={{ padding: '6px', backgroundColor: 'transparent', color: '#666', border: 'none', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}>
                        ⋮
                      </button>
                      {openMenuId === p.id && (
                        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '5px', backgroundColor: 'white', border: '1px solid #eaeaea', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '120px', padding: '5px 0' }}>

                          <button onClick={() => handleDelete(p.id)} style={{ width: '100%', padding: '10px 15px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', color: '#dc2626' }}>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && !error && (
              <tr>
                <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
                  No se encontraron productos que coincidan con la búsqueda.
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: '#dc2626', backgroundColor: '#fef2f2' }}>
                  {error}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`
        @media (max-width: 768px) {
          table, thead, tbody, th, td, tr {
            display: block;
          }
          thead tr {
            position: absolute;
            top: -9999px;
            left: -9999px;
          }
          tr { border-bottom: 1px solid #eaeaea; margin-bottom: 10px; border-radius: 8px; overflow: hidden; background: white; padding: 15px; }
          td {
            border: none;
            position: relative;
            padding: 8px 0 !important;
            text-align: left !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          td:before {
            content: attr(data-label);
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.75rem;
            color: #888;
            padding-right: 15px;
          }
          td:first-child { display: flex !important; justify-content: center !important; margin-bottom: 10px; }
          td:first-child:before { display: none; }
          td:last-child { justify-content: flex-end !important; margin-top: 10px; }
          td:last-child:before { display: none; }
        }
      `}</style>
    </div>
  );
};
