import { useState, useEffect } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import '../../styles/store.css';

interface DashboardMetrics {
  salesTodayAmount: number;
  salesTodayCount: number;
  activeReservations: number;
  resPendientes: number;
  resConfirmadasPreparando: number;
  resListas: number;
  activeCashiers: number;
  lowStockCount: number;
  salesLast7Days: { date: string; amount: number; count: number }[];
  salesByChannel: { POS: number; WEB: number; MOVIL: number };
  topProducts: {
    productId: number;
    productName: string;
    imageUrl: string | null;
    unitsSold: number;
    revenue: number;
  }[];
  salesByBranch?: {
    branchId: number;
    branchName: string;
    totalAmount: number;
    salesCount: number;
  }[];
  salesBySeason?: {
    seasonName: string;
    revenue: number;
  }[];
  salesByCollection?: {
    collectionName: string;
    revenue: number;
  }[];
}

export const DashboardPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [channel, setChannel] = useState<string>('');

  const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (isAdmin && branchId) params.append('branchId', branchId);
        if (channel) params.append('channel', channel);

        const { data } = await api.get(`/dashboard/metrics?${params.toString()}`);
        setMetrics(data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Error al cargar las métricas del dashboard');
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Cargando métricas...</div>;
  if (error) return <div style={{ padding: '40px', color: 'red', textAlign: 'center' }}>{error}</div>;
  if (!metrics) return null;

  const max7DayAmount = Math.max(...metrics.salesLast7Days.map(d => d.amount), 1);
  const totalChannelAmount = (metrics.salesByChannel.POS + metrics.salesByChannel.WEB + metrics.salesByChannel.MOVIL) || 1;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', color: '#1a1a1a', margin: 0 }}>Dashboard Administrativo</h1>
        <p style={{ color: '#666', margin: '4px 0 0 0' }}>Métricas de ventas e inventario</p>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '8px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Desde:</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Hasta:</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
        </div>
        {isAdmin && (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Sucursal ID:</label>
            <input type="number" placeholder="Todas" value={branchId} onChange={e => setBranchId(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100px' }} />
          </div>
        )}
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Canal:</label>
          <select value={channel} onChange={e => setChannel(e.target.value)} style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="">Todos</option>
            <option value="WEB">WEB</option>
            <option value="MOVIL">MÓVIL</option>
            <option value="POS">POS</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button onClick={fetchMetrics} style={{ padding: '8px 16px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Filtrar</button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Ventas de Hoy</span>
          <h2 style={{ fontSize: '1.8rem', color: '#0056b3', margin: '8px 0 0 0' }}>Bs. {Number(metrics.salesTodayAmount).toFixed(2)}</h2>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>N° Ventas Hoy</span>
          <h2 style={{ fontSize: '1.8rem', color: '#198754', margin: '8px 0 0 0' }}>{metrics.salesTodayCount}</h2>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Reservas Activas</span>
          <h2 style={{ fontSize: '1.8rem', color: '#ffc107', margin: '8px 0 0 0' }}>{metrics.activeReservations}</h2>
        </div>

        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Alertas Stock Bajo</span>
          <h2 style={{ fontSize: '1.8rem', color: '#dc3545', margin: '8px 0 0 0' }}>{metrics.lowStockCount}</h2>
        </div>
      </div>

      {!isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Res. Pendientes</span>
            <h2 style={{ fontSize: '1.5rem', color: '#fd7e14', margin: '8px 0 0 0' }}>{metrics.resPendientes}</h2>
          </div>
          
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Res. Confirm/Prep</span>
            <h2 style={{ fontSize: '1.5rem', color: '#0d6efd', margin: '8px 0 0 0' }}>{metrics.resConfirmadasPreparando}</h2>
          </div>
          
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Res. Listas</span>
            <h2 style={{ fontSize: '1.5rem', color: '#20c997', margin: '8px 0 0 0' }}>{metrics.resListas}</h2>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
            <span style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: '600', textTransform: 'uppercase' }}>Cajeros Activos</span>
            <h2 style={{ fontSize: '1.5rem', color: '#6f42c1', margin: '8px 0 0 0' }}>{metrics.activeCashiers}</h2>
          </div>
        </div>
      )}

      {/* Visualizations Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginBottom: '30px' }}>
        
        {/* 7 Days Bar Chart */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#333', marginTop: 0, marginBottom: '20px' }}>Ventas Últimos 7 Días</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '180px', paddingTop: '20px' }}>
            {metrics.salesLast7Days.map((d, i) => {
              const heightPct = Math.max((d.amount / max7DayAmount) * 100, 4);
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '0.7rem', color: '#555', marginBottom: '4px' }}>Bs.{d.amount.toFixed(0)}</span>
                  <div style={{ width: '100%', height: `${heightPct}%`, backgroundColor: '#0056b3', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                  <span style={{ fontSize: '0.72rem', color: '#888', marginTop: '6px' }}>{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales By Channel */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#333', marginTop: 0, marginBottom: '20px' }}>Ventas por Canal</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'POS (Físico)', key: 'POS', color: '#198754' },
              { label: 'WEB', key: 'WEB', color: '#0d6efd' },
              { label: 'MÓVIL', key: 'MOVIL', color: '#6f42c1' },
            ].map((ch) => {
              const amount = metrics.salesByChannel[ch.key as keyof typeof metrics.salesByChannel] || 0;
              const pct = ((amount / totalChannelAmount) * 100).toFixed(1);
              return (
                <div key={ch.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: '600', color: '#333' }}>{ch.label}</span>
                    <span style={{ fontWeight: 'bold' }}>Bs. {amount.toFixed(2)} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '10px', backgroundColor: '#e9ecef', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: ch.color, borderRadius: '5px' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Top Products & Branch Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
        
        {/* Top 5 Products */}
        <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#333', marginTop: 0, marginBottom: '16px' }}>Top 5 Productos Más Vendidos</h3>
          {metrics.topProducts.length === 0 ? (
            <p style={{ color: '#888', fontSize: '0.9rem' }}>No hay ventas registradas aún para calcular el ranking.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                  <th style={{ padding: '8px' }}>Producto</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Unidades</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topProducts.map(p => (
                  <tr key={p.productId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '10px 8px', fontWeight: '500' }}>{p.productName}</td>
                    <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 'bold', color: '#0056b3' }}>{p.unitsSold} u.</td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(p.revenue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Sales by Branch (ADMIN ONLY) */}
        {isAdmin && metrics.salesByBranch && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#333', marginTop: 0, marginBottom: '16px' }}>Ventas por Sucursal</h3>
            {metrics.salesByBranch.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Sin transacciones entre sucursales.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '8px' }}>Sucursal</th>
                    <th style={{ padding: '8px', textAlign: 'center' }}>N° Ventas</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Monto Total</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.salesByBranch.map(b => (
                    <tr key={b.branchId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '500' }}>{b.branchName}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>{b.salesCount}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold', color: '#198754' }}>Bs. {Number(b.totalAmount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px', marginTop: '24px' }}>
        {/* Sales by Season */}
        {metrics.salesBySeason && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#333', marginTop: 0, marginBottom: '16px' }}>Ventas por Temporada</h3>
            {metrics.salesBySeason.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Sin transacciones.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '8px' }}>Temporada</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.salesBySeason.map(s => (
                    <tr key={s.seasonName} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '500' }}>{s.seasonName}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(s.revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Sales by Collection */}
        {metrics.salesByCollection && (
          <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef' }}>
            <h3 style={{ fontSize: '1.1rem', color: '#333', marginTop: 0, marginBottom: '16px' }}>Ventas por Colección</h3>
            {metrics.salesByCollection.length === 0 ? (
              <p style={{ color: '#888', fontSize: '0.9rem' }}>Sin transacciones.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '8px' }}>Colección</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.salesByCollection.map(c => (
                    <tr key={c.collectionName} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '500' }}>{c.collectionName}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(c.revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
