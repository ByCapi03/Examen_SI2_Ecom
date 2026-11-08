import { useState, useEffect } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import '../../styles/store.css';

interface Branch {
  id: number;
  name: string;
}

export const ReportsPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');

  const [activeTab, setActiveTab] = useState<'sales' | 'products' | 'inventory' | 'reservations'>('sales');
  const [branches, setBranches] = useState<Branch[]>([]);

  // Filter Bar
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [channel, setChannel] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');

  // Data State
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      api.get('/branches').then(res => setBranches(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (branchId) params.branchId = branchId;
      if (channel) params.channel = channel;
      if (paymentMethod) params.paymentMethod = paymentMethod;

      const endpoint = `/reports/${activeTab}`;
      const { data } = await api.get(endpoint, { params });
      setReportData(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar el reporte');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, from, to, branchId, channel, paymentMethod]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '2rem', color: '#1a1a1a', margin: 0 }}>Reportes Administrativos</h1>
        <p style={{ color: '#666', margin: '4px 0 0 0' }}>Informes detallados y análisis de rendimiento</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e9ecef' }}>
        {[
          { key: 'sales', label: 'Ventas' },
          { key: 'products', label: 'Productos' },
          { key: 'inventory', label: 'Inventario' },
          { key: 'reservations', label: 'Reservas' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setActiveTab(t.key as any); setReportData(null); }}
            style={{
              padding: '12px 24px',
              border: 'none',
              background: 'none',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              color: activeTab === t.key ? '#0056b3' : '#6c757d',
              borderBottom: activeTab === t.key ? '3px solid #0056b3' : '3px solid transparent',
              marginBottom: '-2px',
              transition: 'color 0.2s, border-color 0.2s'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Global Filter Bar */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '16px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Fecha Desde</label>
            <input 
              type="date" 
              value={from} 
              onChange={e => setFrom(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Fecha Hasta</label>
            <input 
              type="date" 
              value={to} 
              onChange={e => setTo(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          {isAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Sucursal</label>
              <select 
                value={branchId} 
                onChange={e => setBranchId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Todas las sucursales</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}

          {activeTab === 'sales' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Canal</label>
                <select 
                  value={channel} 
                  onChange={e => setChannel(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Todos los canales</option>
                  <option value="POS">POS</option>
                  <option value="WEB">WEB</option>
                  <option value="MOVIL">MÓVIL</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Método de Pago</label>
                <select 
                  value={paymentMethod} 
                  onChange={e => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Todos los métodos</option>
                  <option value="EFECTIVO">EFECTIVO</option>
                  <option value="TARJETA">TARJETA</option>
                  <option value="QR">QR</option>
                  <option value="BILLETERA_MOVIL">BILLETERA_MOVIL</option>
                </select>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              onClick={() => { setFrom(''); setTo(''); setBranchId(''); setChannel(''); setPaymentMethod(''); }}
              style={{ width: '100%', padding: '9px 16px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>

      {error && <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Cargando datos del reporte...</div>
      ) : reportData && (
        <div>
          {/* TAB 1: SALES REPORT */}
          {activeTab === 'sales' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Total Ventas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#0056b3' }}>Bs. {Number(reportData.totalSalesAmount).toFixed(2)}</h3>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>N° de Ventas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#198754' }}>{reportData.salesCount}</h3>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Ticket Promedio</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#6f42c1' }}>Bs. {Number(reportData.averageTicket).toFixed(2)}</h3>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Unidades Vendidas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#fd7e14' }}>{reportData.unitsSold} u.</h3>
                </div>
              </div>

              {/* Breakdown tables */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '14px', color: '#333' }}>Ventas por Día</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Fecha</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Ventas</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.salesByDay.map((d: any) => (
                        <tr key={d.date} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '8px' }}>{d.date}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{d.salesCount}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(d.totalAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <h4 style={{ marginTop: 0, marginBottom: '14px', color: '#333' }}>Ventas por Método de Pago</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                        <th style={{ padding: '8px' }}>Método</th>
                        <th style={{ padding: '8px', textAlign: 'center' }}>Transacciones</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.salesByPaymentMethod.map((pm: any) => (
                        <tr key={pm.method} style={{ borderBottom: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '8px', fontWeight: '600' }}>{pm.method}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{pm.count}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(pm.totalAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS REPORT */}
          {activeTab === 'products' && (
            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
              <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>Rendimiento de Productos Vendidos</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left', borderBottom: '1px solid #eee' }}>
                    <th style={{ padding: '10px' }}>Producto</th>
                    <th style={{ padding: '10px', textAlign: 'center' }}>Unidades Vendidas</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Ingresos Generados</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((p: any) => (
                    <tr key={p.productId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={{ padding: '10px', fontWeight: '500' }}>{p.productName}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#0056b3' }}>{p.unitsSold} u.</td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(p.revenue).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: INVENTORY REPORT */}
          {activeTab === 'inventory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#dc3545' }}>Alertas de Stock Bajo</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#fff5f5', textAlign: 'left', color: '#991b1b' }}>
                      <th style={{ padding: '8px' }}>Sucursal</th>
                      <th style={{ padding: '8px' }}>Producto</th>
                      <th style={{ padding: '8px' }}>Variante</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Disponible</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.lowStock.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '15px', textAlign: 'center', color: '#777' }}>No hay alertas de stock bajo.</td></tr>
                    ) : (
                      reportData.lowStock.map((inv: any) => (
                        <tr key={inv.inventoryId} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '8px' }}>{inv.branchName}</td>
                          <td style={{ padding: '8px', fontWeight: '500' }}>{inv.productName}</td>
                          <td style={{ padding: '8px', color: '#666' }}>{inv.colorName} / {inv.sizeName}</td>
                          <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#dc3545' }}>{inv.available} u.</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>{inv.stockMin} u.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#333' }}>Disponibilidad por Sucursal</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Sucursal</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Stock Total</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Reservado</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Disponible</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.availabilityByBranch.map((b: any) => (
                      <tr key={b.branchId} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{b.branchName}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{b.totalStock} u.</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#d97706' }}>{b.totalReserved} u.</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#198754' }}>{b.totalAvailable} u.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: RESERVATIONS REPORT */}
          {activeTab === 'reservations' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Total Reservas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#333' }}>{reportData.total}</h3>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Pendientes / Activas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#d97706' }}>{reportData.pending}</h3>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Atendidas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#198754' }}>{reportData.attended}</h3>
                </div>
                <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <span style={{ fontSize: '0.8rem', color: '#777' }}>Canceladas</span>
                  <h3 style={{ margin: '6px 0 0 0', color: '#dc3545' }}>{reportData.cancelled}</h3>
                </div>
              </div>

              <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                <h4 style={{ marginTop: 0, marginBottom: '14px', color: '#333' }}>Reservas por Sucursal</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Sucursal</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Total</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Activas</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Atendidas</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Canceladas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.byBranch.map((b: any) => (
                      <tr key={b.branchId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{b.branchName}</td>
                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{b.total}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#d97706' }}>{b.pending}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#198754' }}>{b.attended}</td>
                        <td style={{ padding: '8px', textAlign: 'center', color: '#dc3545' }}>{b.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};
