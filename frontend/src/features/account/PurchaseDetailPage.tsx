import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../api/axios';

interface PurchaseDetail {
  id: number;
  date: string;
  branchName: string;
  channel: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  items: any[];
  payments: any[];
}

export const PurchaseDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [purchase, setPurchase] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { data } = await api.get(`/sales/my/${id}`);
        setPurchase(data);
      } catch (err: any) {
        setError('Error al cargar detalle de compra.');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDetail();
  }, [id]);

  if (loading) return <div>Cargando detalle...</div>;
  if (error || !purchase) return <div style={{ color: 'red' }}>{error || 'Compra no encontrada'}</div>;

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/account/purchases" style={{ color: '#0056b3', textDecoration: 'none' }}>
          &larr; Volver a Mis Compras
        </Link>
      </div>

      <div style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px', border: '1px solid #ddd', marginBottom: '20px' }}>
        <h2 style={{ marginTop: 0 }}>Compra #{purchase.id}</h2>
        <p><strong>Fecha:</strong> {new Date(purchase.date).toLocaleString()}</p>
        <p><strong>Sucursal:</strong> {purchase.branchName}</p>
        <p><strong>Estado:</strong> {purchase.status}</p>
        <p><strong>Canal:</strong> {purchase.channel}</p>
      </div>

      <h3>Productos</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
        <thead>
          <tr style={{ background: '#f5f5f5' }}>
            <th style={{ padding: '10px', textAlign: 'left' }}>Producto</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Variante</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Cantidad</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Precio Unitario</th>
            <th style={{ padding: '10px', textAlign: 'left' }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((item) => (
            <tr key={item.id} style={{ borderBottom: '1px solid #ddd' }}>
              <td style={{ padding: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {item.imageUrl && <img src={item.imageUrl} alt={item.productName} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />}
                  <span>{item.productName}</span>
                </div>
              </td>
              <td style={{ padding: '10px' }}>{item.sizeName} | {item.colorName}</td>
              <td style={{ padding: '10px' }}>{item.quantity}</td>
              <td style={{ padding: '10px' }}>Bs. {item.unitPrice.toFixed(2)}</td>
              <td style={{ padding: '10px' }}>Bs. {item.subtotal.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '300px', background: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span>Subtotal:</span>
            <span>Bs. {purchase.subtotal.toFixed(2)}</span>
          </div>
          {purchase.discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'green' }}>
              <span>Descuento:</span>
              <span>- Bs. {purchase.discount.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #ccc', fontWeight: 'bold', fontSize: '1.2rem' }}>
            <span>Total:</span>
            <span>Bs. {purchase.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
