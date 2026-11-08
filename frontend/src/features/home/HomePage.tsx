import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { api } from '../../api/axios';
import atemporalLogo from '../../assets/ATEMPORAL.png';
import '../../styles/store.css';

interface Product {
  id: number;
  name: string;
  price: number;
  categoryId: number;
  categoryName: string;
  imageUrl: string | null;
}

interface Recommendation {
  product: {
    id: number;
    name: string;
    imageUrl: string | null;
    basePrice: number;
    finalPrice: number;
    discount?: { percentage: number };
  };
  reason: string;
}

export const HomePage = () => {
  const { user } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const isCliente = user?.roles?.includes('CLIENTE');

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const { data } = await api.get('/store/products');
        setFeaturedProducts(data.slice(0, 3));
      } catch (err) {
        console.error("Error fetching products", err);
      } finally {
        setLoading(false);
      }
    };

    const fetchRecommendations = async () => {
      if (!isCliente) return;
      try {
        setLoadingRecs(true);
        const branchIdToUse = cart.branchId || 1;
        const { data } = await api.get(`/intelligence/recommendations/my?branchId=${branchIdToUse}&limit=4`);
        setRecommendations(data.recommendations || []);
      } catch (err) {
        console.error("Error fetching recommendations", err);
      } finally {
        setLoadingRecs(false);
      }
    };

    fetchFeatured();
    fetchRecommendations();
  }, [isCliente, cart.branchId]);

  return (
    <div className="home-page">
      {/* HERO SECTION */}
      <section className="hero-section">
        <div className="hero-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src={atemporalLogo} 
            alt="ATEMPORAL - Moda que trasciende épocas" 
            style={{ maxWidth: '280px', width: '100%', height: 'auto', objectFit: 'contain', marginBottom: '20px', borderRadius: '12px' }} 
          />
          <span className="hero-subtitle">NUEVA COLECCIÓN</span>
          <h1 className="hero-title">Moda que trasciende épocas</h1>

          <p className="hero-text">Descubre nuestra nueva colección diseñada para resaltar tu estilo en cualquier ocasión.</p>
          <button
            className="btn-secondary"
            onClick={() => navigate('/catalog')}
            style={{ marginTop: '10px' }}
          >
            Ver Catálogo
          </button>
        </div>
      </section>

      {/* RECOMENDACIONES IA */}
      {isCliente && (
        <section className="featured-section" style={{ backgroundColor: '#fcfcfc', paddingTop: '40px', paddingBottom: '40px' }}>
          <div className="section-header">
            <h2 className="section-title">Recomendado para ti ✨</h2>
            <div className="section-divider"></div>
          </div>

          {loadingRecs ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <span style={{ fontStyle: 'italic', color: '#666' }}>Analizando tu estilo...</span>
            </div>
          ) : recommendations.length > 0 ? (
            <div className="products-grid">
              {recommendations.map(rec => (
                <div key={rec.product.id} className="product-card" style={{ border: '1px solid #eee' }}>
                  <div
                    className="product-image-placeholder"
                    onClick={() => navigate(`/products/${rec.product.id}`)}
                    style={{ padding: rec.product.imageUrl ? 0 : undefined, overflow: 'hidden', position: 'relative' }}
                  >
                    {rec.product.discount && (
                      <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: '#dc3545', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        -{rec.product.discount.percentage}%
                      </div>
                    )}
                    {rec.product.imageUrl ? (
                      <img src={rec.product.imageUrl} alt={rec.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '[Foto]'
                    )}
                  </div>
                  <h3 className="product-name">{rec.product.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '10px 0' }}>
                    {rec.product.discount ? (
                      <>
                        <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.9rem' }}>Bs. {Number(rec.product.basePrice).toFixed(2)}</span>
                        <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1.1rem' }}>Bs. {Number(rec.product.finalPrice).toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="product-price">Bs. {Number(rec.product.finalPrice).toFixed(2)}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#0056b3', fontStyle: 'italic', marginTop: '0', padding: '0 10px', height: '40px', overflow: 'hidden' }}>
                    "{rec.reason}"
                  </p>
                  <button
                    className="btn-outline"
                    onClick={() => navigate(`/products/${rec.product.id}`)}
                  >
                    Ver Producto
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              No hay recomendaciones disponibles por el momento.
            </div>
          )}
        </section>
      )}

      {/* FEATURED PRODUCTS */}
      <section className="featured-section">
        <div className="section-header">
          <h2 className="section-title">Productos Destacados</h2>
          <div className="section-divider"></div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Cargando productos...</div>
        ) : (
          <div className="products-grid">
            {featuredProducts.map(p => (
              <div key={p.id} className="product-card">
                <div
                  className="product-image-placeholder"
                  onClick={() => navigate(`/products/${p.id}`)}
                  style={{ padding: p.imageUrl ? 0 : undefined, overflow: 'hidden' }}
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    '[Foto]'
                  )}
                </div>
                <h3 className="product-name">{p.name}</h3>
                <p className="product-price">Bs. {Number(p.price).toFixed(2)}</p>
                <button
                  className="btn-outline"
                  onClick={() => navigate(`/products/${p.id}`)}
                >
                  Ver
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
