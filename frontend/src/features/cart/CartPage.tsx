import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from './CartContext';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../api/axios';
import '../../styles/store.css';

export const CartPage = () => {
  const navigate = useNavigate();
  const { cart, removeFromCart, updateQuantity, updateItemAvailability, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  
  const [checkingStock, setCheckingStock] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Refresh stock / availability from backend on mount
  useEffect(() => {
    const refreshStock = async () => {
      if (cart.items.length === 0 || !cart.branchId) return;
      try {
        setCheckingStock(true);
        for (const item of cart.items) {
          const { data } = await api.get(`/store/availability/${item.variantId}`);
          const branchStock = data.find((b: any) => b.branchId === cart.branchId);
          const currentAvailable = branchStock ? branchStock.available : 0;
          updateItemAvailability(item.variantId, currentAvailable);
        }
      } catch (err) {
        console.error('Error refreshing availability for cart items', err);
      } finally {
        setCheckingStock(false);
      }
    };

    refreshStock();
  }, [cart.branchId]);

  const hasStockErrors = cart.items.some(
    item => item.available === 0 || item.quantity > item.available
  );

  const subtotal = cart.items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

  const handleCheckout = () => {
    if (cart.items.length === 0) return;
    
    if (hasStockErrors) {
      setErrorBanner('Ajusta la cantidad de los productos sin disponibilidad suficiente antes de continuar.');
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem('redirectUrl', '/checkout');
      navigate('/login');
    } else {
      navigate('/checkout');
    }
  };

  if (cart.items.length === 0) {
    return (
      <div style={{ maxWidth: '800px', margin: '40px auto', padding: '40px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px', color: '#333' }}>Tu Carrito de Compras</h1>
        <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '30px' }}>Tu carrito está vacío actualmente.</p>
        <Link 
          to="/catalog" 
          style={{ 
            display: 'inline-block', 
            padding: '12px 24px', 
            backgroundColor: '#333', 
            color: '#fff', 
            textDecoration: 'none', 
            borderRadius: '4px',
            fontWeight: 'bold' 
          }}
        >
          Explorar Catálogo
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', color: '#333', margin: 0 }}>Tu Carrito de Compras</h1>
          {cart.branchName && (
            <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.95rem' }}>
              Sucursal seleccionada: <strong>{cart.branchName}</strong>
            </p>
          )}
        </div>
        <button 
          onClick={clearCart} 
          style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline' }}
        >
          Vaciar carrito
        </button>
      </div>

      {checkingStock && (
        <div style={{ backgroundColor: '#e9ecef', color: '#495057', padding: '10px 15px', borderRadius: '4px', marginBottom: '20px', fontSize: '0.9rem' }}>
          🔄 Verificando disponibilidad actualizada de stock...
        </div>
      )}

      {errorBanner && (
        <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '12px 15px', borderRadius: '4px', marginBottom: '20px', fontWeight: '500' }}>
          {errorBanner}
        </div>
      )}

      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        {/* Items List */}
        <div style={{ flex: '1 1 600px' }}>
          {cart.items.map(item => {
            const isOutOfStock = item.available === 0;
            const isExceedingStock = item.quantity > item.available;

            return (
              <div 
                key={item.variantId}
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '20px',
                  border: isOutOfStock || isExceedingStock ? '1px solid #f5c6cb' : '1px solid #eee',
                  backgroundColor: isOutOfStock || isExceedingStock ? '#fff5f5' : '#fff',
                  borderRadius: '8px',
                  marginBottom: '15px',
                  alignItems: 'center'
                }}
              >
                {/* Product Image */}
                <div style={{ width: '90px', height: '90px', backgroundColor: '#f8f9fa', borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: '0.75rem' }}>Sin imagen</div>
                  )}
                </div>

                {/* Details */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#333' }}>{item.productName}</h3>
                  <p style={{ margin: '3px 0', color: '#666', fontSize: '0.88rem' }}>
                    Talla: <strong>{item.size}</strong> | Color: <strong>{item.color}</strong>
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '3px 0' }}>
                    <p style={{ margin: 0, color: '#0056b3', fontWeight: 'bold' }}>
                      Bs. {Number(item.price).toFixed(2)}
                    </p>
                    {item.basePrice && item.basePrice > item.price && (
                      <p style={{ margin: 0, color: '#999', textDecoration: 'line-through', fontSize: '0.85rem' }}>
                        Bs. {Number(item.basePrice).toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Stock Warnings */}
                  {isOutOfStock ? (
                    <span style={{ display: 'inline-block', marginTop: '6px', padding: '3px 8px', backgroundColor: '#dc3545', color: '#fff', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                      Sin disponibilidad
                    </span>
                  ) : isExceedingStock ? (
                    <span style={{ display: 'inline-block', marginTop: '6px', padding: '3px 8px', backgroundColor: '#ffc107', color: '#856404', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 'bold' }}>
                      Solo quedan {item.available} unidades disponibles
                    </span>
                  ) : null}
                </div>

                {/* Quantity Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                    <button 
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      style={{ padding: '6px 12px', border: 'none', background: '#f0f0f0', cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      -
                    </button>
                    <span style={{ padding: '6px 14px', minWidth: '35px', textAlign: 'center', fontWeight: 'bold' }}>
                      {item.quantity}
                    </span>
                    <button 
                      onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= item.available}
                      style={{ padding: '6px 12px', border: 'none', background: '#f0f0f0', cursor: item.quantity >= item.available ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}
                    >
                      +
                    </button>
                  </div>

                  <span style={{ fontWeight: 'bold', color: '#333' }}>
                    Bs. {(Number(item.price) * item.quantity).toFixed(2)}
                  </span>

                  <button 
                    onClick={() => removeFromCart(item.variantId)}
                    style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', padding: 0 }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Box */}
        <div style={{ flex: '1 1 300px', backgroundColor: '#f8f9fa', padding: '25px', borderRadius: '8px', border: '1px solid #eee', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.4rem', margin: '0 0 20px 0', color: '#333' }}>Resumen de Compra</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '1rem', color: '#555' }}>
            <span>Subtotal</span>
            <span>Bs. {subtotal.toFixed(2)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '1.25rem', fontWeight: 'bold', color: '#333', borderTop: '1px solid #ddd', paddingTop: '15px' }}>
            <span>Total</span>
            <span style={{ color: '#0056b3' }}>Bs. {subtotal.toFixed(2)}</span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={hasStockErrors}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: hasStockErrors ? '#aaa' : '#333',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1.05rem',
              fontWeight: 'bold',
              cursor: hasStockErrors ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            CONTINUAR COMPRA
          </button>

          {hasStockErrors && (
            <p style={{ color: '#dc3545', fontSize: '0.82rem', marginTop: '10px', textAlign: 'center' }}>
              Hay productos con problemas de disponibilidad. Modifícalos para continuar.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
