import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/axios';

interface PurchaseSummary {
  id: number;
  date: string;
  branchName: string;
  channel: string;
  status: string;
  total: number;
  itemsCount: number;
}

export const PurchasesPage = () => {
  const [purchases, setPurchases] = useState<PurchaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const { data } = await api.get('/sales/my');
        setPurchases(data);
      } catch (err: any) {
        setError('Error al cargar compras.');
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, []);

  if (loading) return <div>Cargando compras...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div>
      <h2>Historial de Compras</h2>
      {purchases.length === 0 ? (
        <p>Aún no has realizado compras.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '10px', textAlign: 'left' }}># Compra</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Sucursal</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Canal</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Total</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Estado</th>
              <th style={{ padding: '10px', textAlign: 'left' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={{ padding: '10px' }}>{p.id}</td>
                <td style={{ padding: '10px' }}>{new Date(p.date).toLocaleDateString()}</td>
                <td style={{ padding: '10px' }}>{p.branchName}</td>
                <td style={{ padding: '10px' }}>{p.channel}</td>
                <td style={{ padding: '10px' }}>Bs. {p.total.toFixed(2)}</td>
                <td style={{ padding: '10px' }}>
                  <span style={{ padding: '4px 8px', borderRadius: '4px', background: p.status === 'COMPLETADA' ? '#d4edda' : '#f8d7da', color: p.status === 'COMPLETADA' ? '#155724' : '#721c24' }}>
                    {p.status}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>
                  <Link to={`/account/purchases/${p.id}`} style={{ color: '#0056b3', textDecoration: 'none' }}>
                    Ver Detalle
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
