import { useState, useEffect } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';
import '../../styles/store.css';

interface SaleSummary {
  id: number;
  date: string;
  clientName: string;
  clientEmail: string | null;
  branchName: string;
  branchId: number;
  channel: string;
  status: string;
  total: number;
  paymentMethod: string | null;
  registeredBy: string;
}

interface Branch {
  id: number;
  name: string;
}

interface SaleDetail {
  id: number;
  date: string;
  channel: string;
  status: string;
  subtotal: number;
  discount: number;
  total: number;
  branch: { id: number; name: string };
  client: { id: number; name: string; email: string; phone?: string } | null;
  registeredBy: string;
  items: {
    id: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    productName: string;
    imageUrl: string | null;
    sizeName: string;
    colorName: string;
    sku: string;
  }[];
  payments: {
    id: number;
    method: string;
    amount: number;
    status: string;
    date: string;
  }[];
}

export const SalesAdminPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes('ADMIN');

  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [branchId, setBranchId] = useState('');
  const [channel, setChannel] = useState('');
  const [status, setStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [search, setSearch] = useState('');

  // Modal Detail
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [saleDetail, setSaleDetail] = useState<SaleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      api.get('/branches').then(res => setBranches(res.data)).catch(() => {});
    }
  }, [isAdmin]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;
      if (branchId) params.branchId = branchId;
      if (channel) params.channel = channel;
      if (status) params.status = status;
      if (paymentMethod) params.paymentMethod = paymentMethod;
      if (search) params.search = search;

      const { data } = await api.get('/sales', { params });
      setSales(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar las ventas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [from, to, branchId, channel, status, paymentMethod]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSales();
  };

  const handleOpenDetail = async (id: number) => {
    setSelectedSaleId(id);
    try {
      setLoadingDetail(true);
      const { data } = await api.get(`/sales/${id}`);
      setSaleDetail(data);
    } catch (err: any) {
      alert('Error al obtener el detalle de la venta');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedSaleId(null);
    setSaleDetail(null);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: '#1a1a1a', margin: 0 }}>Gestión de Ventas</h1>
          <p style={{ color: '#666', margin: '4px 0 0 0' }}>Historial y monitoreo de transacciones realizadas</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '8px', border: '1px solid #e9ecef', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Fecha Desde</label>
            <input 
              type="date" 
              value={from} 
              onChange={e => setFrom(e.target.value)} 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Fecha Hasta</label>
            <input 
              type="date" 
              value={to} 
              onChange={e => setTo(e.target.value)} 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          {isAdmin && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Sucursal</label>
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

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Canal</label>
            <select 
              value={channel} 
              onChange={e => setChannel(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Todos los canales</option>
              <option value="POS">POS (Físico)</option>
              <option value="WEB">WEB</option>
              <option value="MOVIL">MÓVIL</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Estado</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="">Todos los estados</option>
              <option value="COMPLETADA">COMPLETADA</option>
              <option value="PAGADA">PAGADA</option>
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="CANCELADA">CANCELADA</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Método de Pago</label>
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

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#555', marginBottom: '4px' }}>Búsqueda</label>
            <input 
              type="text" 
              placeholder="Cliente, email o N° venta..."
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ flex: 1, padding: '9px 16px', backgroundColor: '#1a1a1a', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
              Buscar
            </button>
            <button 
              type="button" 
              onClick={() => { setFrom(''); setTo(''); setBranchId(''); setChannel(''); setStatus(''); setPaymentMethod(''); setSearch(''); }}
              style={{ padding: '9px 16px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Limpiar
            </button>
          </div>
        </form>
      </div>

      {error && <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '12px', borderRadius: '4px', marginBottom: '20px' }}>{error}</div>}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Cargando ventas...</div>
      ) : (
        <div style={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f3f5', borderBottom: '1px solid #dee2e6', color: '#495057' }}>
                <th style={{ padding: '12px 16px' }}>N°</th>
                <th style={{ padding: '12px 16px' }}>Fecha</th>
                <th style={{ padding: '12px 16px' }}>Cliente</th>
                <th style={{ padding: '12px 16px' }}>Sucursal</th>
                <th style={{ padding: '12px 16px' }}>Canal</th>
                <th style={{ padding: '12px 16px' }}>Método</th>
                <th style={{ padding: '12px 16px' }}>Estado</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '30px', textAlign: 'center', color: '#777' }}>
                    No se encontraron registros de ventas con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                sales.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>#{s.id}</td>
                    <td style={{ padding: '12px 16px' }}>{new Date(s.date).toLocaleString()}</td>
                    <td style={{ padding: '12px 16px' }}>{s.clientName}</td>
                    <td style={{ padding: '12px 16px' }}>{s.branchName}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold', backgroundColor: s.channel === 'POS' ? '#e2e3e5' : '#cff4fc', color: s.channel === 'POS' ? '#383d41' : '#055160' }}>
                        {s.channel}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{s.paymentMethod || 'N/A'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ 
                        padding: '3px 8px', 
                        borderRadius: '4px', 
                        fontSize: '0.8rem', 
                        fontWeight: 'bold',
                        backgroundColor: s.status === 'COMPLETADA' || s.status === 'PAGADA' ? '#d1e7dd' : s.status === 'CANCELADA' ? '#f8d7da' : '#fff3cd',
                        color: s.status === 'COMPLETADA' || s.status === 'PAGADA' ? '#0f5132' : s.status === 'CANCELADA' ? '#842029' : '#664d03'
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 'bold', color: '#0056b3' }}>
                      Bs. {Number(s.total).toFixed(2)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button 
                        onClick={() => handleOpenDetail(s.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#0056b3', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.85rem', cursor: 'pointer' }}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSaleId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '8px', maxWidth: '750px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '25px', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, color: '#1a1a1a' }}>Detalle de Venta #{selectedSaleId}</h2>
              <button onClick={handleCloseDetail} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#888' }}>&times;</button>
            </div>

            {loadingDetail || !saleDetail ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>Cargando detalle de venta...</div>
            ) : (
              <div>
                {/* Meta info grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', backgroundColor: '#f8f9fa', padding: '15px', borderRadius: '6px', marginBottom: '20px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>Fecha y Hora</span>
                    <strong>{new Date(saleDetail.date).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>Sucursal</span>
                    <strong>{saleDetail.branch?.name}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>Canal de Venta</span>
                    <strong>{saleDetail.channel}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>Registrado por</span>
                    <strong>{saleDetail.registeredBy}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>Cliente</span>
                    <strong>{saleDetail.client ? saleDetail.client.name : 'Cliente General'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#777', display: 'block' }}>Estado Venta</span>
                    <strong>{saleDetail.status}</strong>
                  </div>
                </div>

                {/* Items Table */}
                <h4 style={{ marginBottom: '10px', color: '#333' }}>Productos Vendidos</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#eee', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Producto</th>
                      <th style={{ padding: '8px' }}>Variante</th>
                      <th style={{ padding: '8px', textAlign: 'center' }}>Cantidad</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>P. Unitario</th>
                      <th style={{ padding: '8px', textAlign: 'right' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleDetail.items.map(item => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '8px', fontWeight: '500' }}>{item.productName}</td>
                        <td style={{ padding: '8px', color: '#666' }}>{item.colorName} / {item.sizeName}</td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>Bs. {Number(item.unitPrice).toFixed(2)}</td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Bs. {Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Payments */}
                <h4 style={{ marginBottom: '10px', color: '#333' }}>Pagos Registraros</h4>
                <div style={{ marginBottom: '20px' }}>
                  {saleDetail.payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8f9fa', borderRadius: '4px', marginBottom: '6px' }}>
                      <span>Método: <strong>{p.method}</strong> ({p.status})</span>
                      <span style={{ fontWeight: 'bold' }}>Bs. {Number(p.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div style={{ borderTop: '2px solid #ddd', paddingTop: '15px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div>Subtotal: <strong>Bs. {Number(saleDetail.subtotal).toFixed(2)}</strong></div>
                  {saleDetail.discount > 0 && <div>Descuento: <strong style={{ color: 'green' }}>- Bs. {Number(saleDetail.discount).toFixed(2)}</strong></div>}
                  <div style={{ fontSize: '1.25rem', color: '#0056b3', marginTop: '4px' }}>
                    Total: <strong>Bs. {Number(saleDetail.total).toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
