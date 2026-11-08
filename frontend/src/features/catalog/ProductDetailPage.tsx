import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/axios';
import { useCart } from '../cart/CartContext';
import { useAuth } from '../auth/AuthContext';
import '../../styles/store.css';

interface VariantInfo {
  id: number;
  sku: string;
  sizeId: number;
  sizeName: string;
  colorId: number;
  colorName: string;
  colorHexCode?: string;
  previewImageUrl?: string;
  previewArImageUrl?: string;
}

interface ProductDetail {
  id: number;
  name: string;
  price: number;
  finalPrice?: number;
  discount?: { type: string; value: number; amount: number } | null;
  categoryName: string;
  seasonName?: string;
  collectionName?: string;
  imageUrl: string | null;
  arEnabled?: boolean;
  arImageUrl?: string | null;
  arType?: string | null;
  variants: VariantInfo[];
}

interface Availability {
  branchId: number;
  branchName: string;
  cityId: number;
  cityName: string;
  available: number;
  status: 'AVAILABLE' | 'LOW_STOCK';
}

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedColorId, setSelectedColorId] = useState<number | null>(null);
  const [selectedSizeId, setSelectedSizeId] = useState<number | null>(null);
  
  // Availability state
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  
  // Quantity state
  const [quantity, setQuantity] = useState(1);

  // User feedback messages
  const [cartSuccessMessage, setCartSuccessMessage] = useState<string | null>(null);
  const [cartErrorMessage, setCartErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/store/products/${id}`);
        setProduct(data);
      } catch (err: any) {
        setError('Producto no encontrado o no disponible');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  // Derived unique colors and sizes based on current selection to enforce validity
  const getAvailableColors = () => {
    if (!product) return [];
    if (!selectedSizeId) return Array.from(new Set(product.variants.map(v => v.colorId)))
      .map(cid => product.variants.find(v => v.colorId === cid)!);
    return product.variants.filter(v => v.sizeId === selectedSizeId);
  };

  const getAvailableSizes = () => {
    if (!product) return [];
    if (!selectedColorId) return Array.from(new Set(product.variants.map(v => v.sizeId)))
      .map(sid => product.variants.find(v => v.sizeId === sid)!);
    return product.variants.filter(v => v.colorId === selectedColorId);
  };

  const uniqueColors = getAvailableColors().filter((v, i, a) => a.findIndex(t => t.colorId === v.colorId) === i);
  const uniqueSizes = getAvailableSizes().filter((v, i, a) => a.findIndex(t => t.sizeId === v.sizeId) === i);

  // Find selected variant
  const selectedVariant = product?.variants.find(
    v => v.colorId === selectedColorId && v.sizeId === selectedSizeId
  );

  const selectedColorVariant = product?.variants.find(
    v => v.colorId === selectedColorId
  );

  useEffect(() => {
    if (selectedVariant) {
      const fetchAvailability = async () => {
        try {
          setLoadingAvailability(true);
          setAvailabilities([]);
          setSelectedCityId(null);
          setSelectedBranchId(null);
          setQuantity(1);
          setCartSuccessMessage(null);
          setCartErrorMessage(null);
          const { data } = await api.get(`/store/availability/${selectedVariant.id}`);
          setAvailabilities(data);
        } catch (err) {
          console.error("Error fetching availability", err);
        } finally {
          setLoadingAvailability(false);
        }
      };
      fetchAvailability();
    } else {
      setAvailabilities([]);
      setSelectedCityId(null);
      setSelectedBranchId(null);
      setQuantity(1);
    }
  }, [selectedVariant]);

  const uniqueCities = Array.from(new Set(availabilities.map(a => a.cityId)))
    .map(cid => availabilities.find(a => a.cityId === cid)!);

  const branchesInSelectedCity = availabilities.filter(a => a.cityId === selectedCityId);

  const selectedBranchAvailability = branchesInSelectedCity.find(b => b.branchId === selectedBranchId);

  const maxAvailable = selectedBranchAvailability ? selectedBranchAvailability.available : 0;

  const handleCityChange = (cityId: number | null) => {
    setSelectedCityId(cityId);
    setSelectedBranchId(null);
    setQuantity(1);
    setCartSuccessMessage(null);
    setCartErrorMessage(null);
  };

  const handleBranchSelect = (branchId: number) => {
    setSelectedBranchId(branchId);
    setQuantity(1);
    setCartSuccessMessage(null);
    setCartErrorMessage(null);
  };

  const handleReserve = () => {
    if (!product || !selectedVariant || !selectedBranchId || !selectedBranchAvailability) return;
    
    const reservationState = {
      productId: product.id,
      productName: product.name,
      price: product.finalPrice || product.price,
      variantId: selectedVariant.id,
      sizeName: selectedVariant.sizeName,
      colorName: selectedVariant.colorName,
      branchId: selectedBranchId,
      branchName: selectedBranchAvailability.branchName,
      quantity
    };

    if (!isAuthenticated) {
      sessionStorage.setItem('pendingReservation', JSON.stringify(reservationState));
      navigate('/login');
    } else {
      navigate('/reservations/new', { state: reservationState });
    }
  };

  const handleAddToCart = () => {
    if (!product || !selectedVariant || !selectedBranchId || !selectedBranchAvailability) return;

    setCartSuccessMessage(null);
    setCartErrorMessage(null);

    const result = addToCart(
      {
        productId: product.id,
        variantId: selectedVariant.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        size: selectedVariant.sizeName,
        color: selectedVariant.colorName,
        price: product.finalPrice || product.price,
        basePrice: product.price,
        quantity,
        available: selectedBranchAvailability.available
      },
      selectedBranchAvailability.branchId,
      selectedBranchAvailability.branchName
    );

    if (result.success) {
      setCartSuccessMessage('✔ Producto agregado al carrito con éxito');
    } else {
      setCartErrorMessage(result.message || 'No se pudo agregar al carrito');
    }
  };

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Cargando detalles...</div>;
  if (error || !product) return <div style={{ padding: '50px', textAlign: 'center', color: 'red' }}>{error}</div>;

  const isActionDisabled = !selectedVariant || !selectedBranchId || quantity < 1 || maxAvailable < quantity;

  const currentImageUrl = selectedVariant?.previewImageUrl || selectedColorVariant?.previewImageUrl || product.imageUrl;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px', display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
      
      {/* Product Image */}
      <div style={{ flex: '1 1 400px', backgroundColor: '#f8f9fa', borderRadius: '8px', minHeight: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', border: '1px solid #eee', overflow: 'hidden' }}>
        {currentImageUrl ? (
          <img src={currentImageUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          '[Imagen Principal del Producto]'
        )}
      </div>

      {/* Product Info & Selection */}
      <div style={{ flex: '1 1 400px' }}>
        <button onClick={() => navigate('/catalog')} style={{ background: 'none', border: 'none', color: 'var(--atemporal-gold)', cursor: 'pointer', padding: 0, marginBottom: '20px', fontWeight: 'bold' }}>&larr; Volver al catálogo</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--atemporal-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{product.categoryName}</span>
          <div style={{ display: 'flex', gap: '5px' }}>
            {product.seasonName && <span style={{ fontSize: '0.8rem', backgroundColor: '#e2e8f0', padding: '4px 8px', borderRadius: '4px' }}>{product.seasonName}</span>}
            {product.collectionName && <span style={{ fontSize: '0.8rem', backgroundColor: '#fed7aa', padding: '4px 8px', borderRadius: '4px' }}>{product.collectionName}</span>}
          </div>
        </div>
        <h1 style={{ fontSize: '2.5rem', margin: '10px 0', color: 'var(--atemporal-green)' }}>{product.name}</h1>
        {product.discount ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
            <p style={{ fontSize: '1.2rem', textDecoration: 'line-through', color: '#999', margin: 0 }}>Bs. {Number(product.price).toFixed(2)}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e53e3e', margin: 0 }}>Bs. {Number(product.finalPrice).toFixed(2)}</p>
            <span style={{ backgroundColor: '#e53e3e', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {product.discount.type === 'PERCENTAGE' ? `-${product.discount.value}%` : `-Bs.${product.discount.value}`} OFF
            </span>
          </div>
        ) : (
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--atemporal-gold)', marginBottom: '30px' }}>Bs. {Number(product.price).toFixed(2)}</p>
        )}

        {/* Color Selection */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '10px', color: 'var(--atemporal-green-dark)' }}>
            Color: <span style={{ fontWeight: 'normal' }}>{uniqueColors.find(c => c.colorId === selectedColorId)?.colorName || 'Seleccione un color'}</span>
          </h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {uniqueColors.map(v => (
              <button
                key={`color-${v.colorId}`}
                title={v.colorName}
                onClick={() => setSelectedColorId(selectedColorId === v.colorId ? null : v.colorId)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: selectedColorId === v.colorId ? '2px solid var(--atemporal-gold)' : '1px solid var(--atemporal-border)',
                  backgroundColor: v.colorHexCode || 'var(--atemporal-cream)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: v.colorHexCode ? 'transparent' : 'var(--atemporal-text)',
                  cursor: 'pointer',
                  padding: 0,
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {!v.colorHexCode && <span style={{ fontSize: '10px' }}>{v.colorName.substring(0, 3)}</span>}
                {/* Precache image invisibly to avoid flicker */}
                {v.previewImageUrl && (
                  <link rel="preload" as="image" href={v.previewImageUrl} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Size Selection */}
        <div style={{ marginBottom: '30px' }}>
          <h4 style={{ marginBottom: '10px', color: 'var(--atemporal-green-dark)' }}>Talla</h4>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {uniqueSizes.map(v => (
              <button
                key={`size-${v.sizeId}`}
                onClick={() => setSelectedSizeId(selectedSizeId === v.sizeId ? null : v.sizeId)}
                style={{
                  padding: '8px 16px',
                  border: selectedSizeId === v.sizeId ? '2px solid var(--atemporal-green)' : '1px solid var(--atemporal-border)',
                  backgroundColor: selectedSizeId === v.sizeId ? 'var(--atemporal-cream)' : 'var(--atemporal-white)',
                  color: 'var(--atemporal-text)',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {v.sizeName}
              </button>
            ))}
          </div>
        </div>

        {/* Availability Flow */}
        {selectedColorId && selectedSizeId && (
          <div style={{ borderTop: '1px solid #eee', paddingTop: '20px' }}>
            <h3 style={{ marginBottom: '15px' }}>Disponibilidad en Tiendas</h3>
            
            {loadingAvailability ? (
              <p>Consultando inventario en tiempo real...</p>
            ) : availabilities.length === 0 ? (
              <p style={{ color: 'red', fontWeight: 'bold' }}>Sin stock disponible para esta combinación.</p>
            ) : (
              <>
                {/* City selector */}
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Ciudad</label>
                  <select 
                    value={selectedCityId || ''} 
                    onChange={e => handleCityChange(e.target.value ? Number(e.target.value) : null)}
                    className="form-select"
                  >
                    <option value="">Seleccione una ciudad...</option>
                    {uniqueCities.map(c => <option key={c.cityId} value={c.cityId}>{c.cityName}</option>)}
                  </select>
                </div>

                {/* Branch list */}
                {selectedCityId && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Sucursal</label>
                    <div style={{ display: 'grid', gap: '10px' }}>
                      {branchesInSelectedCity.map(b => (
                        <div 
                          key={b.branchId}
                          onClick={() => handleBranchSelect(b.branchId)}
                          style={{
                            padding: '15px',
                            border: selectedBranchId === b.branchId ? '2px solid var(--atemporal-green)' : '1px solid var(--atemporal-border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: selectedBranchId === b.branchId ? 'var(--atemporal-cream)' : 'var(--atemporal-white)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 'bold', display: 'block', color: 'var(--atemporal-green-dark)' }}>{b.branchName}</span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--atemporal-muted)' }}>Disponible: {b.available} unidades</span>
                          </div>
                          <span style={{ 
                            fontSize: '0.85rem', 
                            padding: '4px 8px', 
                            borderRadius: '12px', 
                            backgroundColor: b.status === 'AVAILABLE' ? 'var(--atemporal-green-soft)' : '#fcf8e3',
                            color: b.status === 'AVAILABLE' ? 'var(--atemporal-cream)' : '#8a6d3b'
                          }}>
                            {b.status === 'AVAILABLE' ? 'Disponible' : 'Pocas Unidades'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quantity selector */}
                {selectedBranchId && selectedBranchAvailability && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Cantidad</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                        <button 
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                          style={{ padding: '8px 16px', border: 'none', background: '#f0f0f0', cursor: quantity <= 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                        >
                          -
                        </button>
                        <span style={{ padding: '8px 20px', minWidth: '40px', textAlign: 'center', fontWeight: 'bold' }}>
                          {quantity}
                        </span>
                        <button 
                          onClick={() => setQuantity(q => Math.min(maxAvailable, q + 1))}
                          disabled={quantity >= maxAvailable}
                          style={{ padding: '8px 16px', border: 'none', background: '#f0f0f0', cursor: quantity >= maxAvailable ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                        >
                          +
                        </button>
                      </div>
                      <span style={{ fontSize: '0.85rem', color: '#666' }}>
                        (Máximo: {maxAvailable})
                      </span>
                    </div>
                  </div>
                )}

                {/* Feedback Banners */}
                {cartSuccessMessage && (
                  <div style={{ backgroundColor: '#d4edda', color: '#155724', padding: '10px 14px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.95rem' }}>
                    {cartSuccessMessage}
                  </div>
                )}
                {cartErrorMessage && (
                  <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '10px 14px', borderRadius: '4px', marginBottom: '15px', fontSize: '0.95rem' }}>
                    {cartErrorMessage}
                  </div>
                )}

                {/* Reservation & Cart Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <button 
                    disabled={isActionDisabled}
                    onClick={handleReserve}
                    className="btn-primary"
                    style={{ 
                      width: '100%', 
                      padding: '15px', 
                      fontSize: '1.05rem', 
                      opacity: isActionDisabled ? 0.5 : 1,
                      cursor: isActionDisabled ? 'not-allowed' : 'pointer' 
                    }}
                  >
                    Reservar en tienda
                  </button>

                  <button 
                    disabled={isActionDisabled}
                    onClick={handleAddToCart}
                    className="btn-secondary"
                    style={{ 
                      width: '100%', 
                      padding: '15px', 
                      fontSize: '1.05rem', 
                      opacity: isActionDisabled ? 0.5 : 1,
                      cursor: isActionDisabled ? 'not-allowed' : 'pointer' 
                    }}
                  >
                    Agregar al carrito
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Divider & Virtual Try-On Button (Independent of branch/city/quantity) */}
        {selectedVariant && product.arEnabled && product.arType && (product.arImageUrl || product.imageUrl) && (
          <div style={{ borderTop: '1px solid var(--atemporal-border)', marginTop: '25px', paddingTop: '20px' }}>
            <button 
              style={{ width: '100%', padding: '15px', backgroundColor: 'var(--atemporal-gold)', color: 'var(--atemporal-white)', border: 'none', borderRadius: '4px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.3s' }}
              onClick={() => navigate(`/try-on/${selectedVariant.id}`)}
              onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'var(--atemporal-beige)'}
              onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = 'var(--atemporal-gold)'}
            >
              ✨ Probar virtualmente
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
