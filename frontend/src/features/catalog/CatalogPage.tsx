import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';

interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  categoryName: string;
  imageUrl: string | null;
  finalPrice?: number;
  discount?: { type: string; value: number; amount: number } | null;
  seasonName?: string;
  collectionName?: string;
}

export const CatalogPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSeason, setSelectedSeason] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [onlyPromotions, setOnlyPromotions] = useState<boolean>(false);

  // Extract unique values from products
  const categories = Array.from(new Set(products.map(p => p.categoryName).filter(Boolean))).sort();
  const seasons = Array.from(new Set(products.map(p => p.seasonName).filter(Boolean))).sort();
  const collections = Array.from(new Set(products.map(p => p.collectionName).filter(Boolean))).sort();

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/store/products');
        setProducts(data);
        setError(null);
      } catch (err: any) {
        setError('No se pudo conectar con el servidor');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter(p => {
    if (selectedCategory && p.categoryName !== selectedCategory) return false;
    if (selectedSeason && p.seasonName !== selectedSeason) return false;
    if (selectedCollection && p.collectionName !== selectedCollection) return false;
    if (onlyPromotions && !p.discount) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--atemporal-green)' }}>Catálogo de Productos</h1>
        <p style={{ color: 'var(--atemporal-muted)', fontSize: '1.1rem' }}>Encuentra las mejores prendas y accesorios</p>
      </header>

      {error && <div style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{error}</div>}

      <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input"
          style={{ minWidth: '250px', width: 'auto' }}
        />
        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="form-select"
          style={{ minWidth: '180px', width: 'auto' }}
        >
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={selectedSeason}
          onChange={e => setSelectedSeason(e.target.value)}
          className="form-select"
          style={{ minWidth: '180px', width: 'auto' }}
        >
          <option value="">Todas las temporadas</option>
          {seasons.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={selectedCollection}
          onChange={e => setSelectedCollection(e.target.value)}
          className="form-select"
          style={{ minWidth: '180px', width: 'auto' }}
        >
          <option value="">Todas las colecciones</option>
          {collections.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={onlyPromotions}
            onChange={e => setOnlyPromotions(e.target.checked)}
          />
          Solo Promociones
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>Cargando productos...</div>
      ) : (
        <div className="products-grid">
          {filteredProducts.map(p => (
            <div
              key={p.id}
              className="product-card"
              onClick={() => navigate(`/products/${p.id}`)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <div className="product-image-placeholder" style={{ position: 'relative' }}>
                {p.discount && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: '#e53e3e', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    {p.discount.type === 'PERCENTAGE' ? `-${p.discount.value}%` : `-Bs.${p.discount.value}`}
                  </div>
                )}
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                ) : (
                  '[Imagen del Producto]'
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--atemporal-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {p.categoryName}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    {p.seasonName && <span style={{ fontSize: '0.7rem', backgroundColor: '#e2e8f0', padding: '2px 6px', borderRadius: '4px' }}>{p.seasonName}</span>}
                    {p.collectionName && <span style={{ fontSize: '0.7rem', backgroundColor: '#fed7aa', padding: '2px 6px', borderRadius: '4px' }}>{p.collectionName}</span>}
                  </div>
                </div>
                <h3 className="product-name" style={{ marginTop: '8px' }}>{p.name}</h3>
                {p.discount ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <p style={{ margin: 0, textDecoration: 'line-through', color: '#999', fontSize: '0.9rem' }}>Bs. {Number(p.price).toFixed(2)}</p>
                    <p className="product-price" style={{ margin: 0, color: '#e53e3e' }}>Bs. {Number((p as any).finalPrice).toFixed(2)}</p>
                  </div>
                ) : (
                  <p className="product-price" style={{ margin: 0 }}>Bs. {Number(p.price).toFixed(2)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && filteredProducts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
          No se encontraron productos que coincidan con tu búsqueda.
        </div>
      )}
    </div>
  );
};
