import { useState, useEffect } from 'react';
import { api } from '../../api/axios';
import { useAuth } from '../auth/AuthContext';

interface Inventory {
  id: number;
  stock: number;
  reserved: number;
  stockMin: number;
  stockMax: number | null;
  updatedAt: string;
  branchId: number;
  variantId: number;
  branch?: { name: string };
  variant?: { sku: string, product: { name: string }, size: { name: string }, color: { name: string } };
}

export const InventoryAdminPage = () => {
  const { user } = useAuth();
  const isAdmin = user?.roles.includes('ADMIN');
  const isEncargado = user?.roles.includes('ENCARGADO');

  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  const [variants, setVariants] = useState<{id: number, sku: string, product: {name: string}}[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterBranch, setFilterBranch] = useState<number | ''>(isAdmin ? '' : (user?.branchId || ''));
  const [filterSearch, setFilterSearch] = useState('');

  // Modals
  const [showLimitsForm, setShowLimitsForm] = useState<Inventory | null>(null);
  const [limitsForm, setLimitsForm] = useState({ stockMin: 0, stockMax: 0 });

  const [showMovementForm, setShowMovementForm] = useState(false);
  const [movementForm, setMovementForm] = useState({ inventoryId: 0, type: 'ENTRADA', quantity: 0, observation: '' });

  // Creation
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ branchId: isEncargado ? (user?.branchId || 0) : 0, variantId: 0, stockMin: 0, stockMax: 0 });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [invRes, branchRes, varRes] = await Promise.all([
        api.get('/inventory'),
        isAdmin ? api.get('/branches') : Promise.resolve({ data: [] }),
        api.get('/variants')
      ]);
      setInventoryList(invRes.data);
      if (isAdmin) setBranches(branchRes.data);
      setVariants(varRes.data);
      setError(null);
    } catch (err: any) {
      setError('Error al cargar inventario: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLimitsForm) return;
    try {
      await api.patch(`/inventory/${showLimitsForm.id}`, {
        stockMin: Number(limitsForm.stockMin),
        stockMax: limitsForm.stockMax ? Number(limitsForm.stockMax) : null
      });
      setShowLimitsForm(null);
      fetchData();
    } catch (err: any) {
      alert('Error guardando lmites: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleRegisterMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory/movement', {
        inventoryId: Number(movementForm.inventoryId),
        type: movementForm.type,
        quantity: Number(movementForm.quantity),
        observation: movementForm.observation
      });
      setShowMovementForm(false);
      setMovementForm({ inventoryId: 0, type: 'ENTRADA', quantity: 0, observation: '' });
      fetchData();
    } catch (err: any) {
      alert('Error registrando movimiento: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleCreateInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/inventory', {
        branchId: Number(createForm.branchId),
        variantId: Number(createForm.variantId),
        stockMin: Number(createForm.stockMin),
        stockMax: createForm.stockMax ? Number(createForm.stockMax) : null
      });
      setShowCreateForm(false);
      setCreateForm({ branchId: isEncargado ? (user?.branchId || 0) : 0, variantId: 0, stockMin: 0, stockMax: 0 });
      fetchData();
    } catch (err: any) {
      alert('Error creando inventario: ' + (err.response?.data?.message || err.message));
    }
  };

  const getStockStatus = (inv: Inventory) => {
    const available = inv.stock - inv.reserved;
    if (available <= inv.stockMin) return '🔴 Critico';
    if (available <= inv.stockMin + 5) return '🟡 Bajo';
    return '🟢 Normal';
  };

  const filteredInventory = inventoryList.filter(inv => {
    if (filterBranch && inv.branchId !== Number(filterBranch)) return false;
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      const skuMatch = inv.variant?.sku.toLowerCase().includes(search);
      const nameMatch = inv.variant?.product.name.toLowerCase().includes(search);
      if (!skuMatch && !nameMatch) return false;
    }
    return true;
  });

  return (
    <div className="dashboard-container">
      <div className="page-header">
        <h1 className="page-title">Inventario</h1>
        <p className="page-subtitle">Control de existencias por sucursal</p>
      </div>

      <section className="content-card">
        <div className="crud-header">
          <h2>Gestin de Stock</h2>
          <div className="crud-actions">
            <button className="btn-secondary" onClick={() => setShowCreateForm(!showCreateForm)}>
              {showCreateForm ? 'Cerrar' : '+ Iniciar Inventario Variante'}
            </button>
            <button className="btn-primary" onClick={() => setShowMovementForm(!showMovementForm)}>
              {showMovementForm ? 'Cerrar' : '+ Registrar Movimiento'}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Filters */}
        <div className="filters-bar" style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
          {isAdmin && (
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Sucursal</label>
              <select value={filterBranch} onChange={e => setFilterBranch(e.target.value ? Number(e.target.value) : '')} style={{ width: '100%' }}>
                <option value="">Todas las sucursales</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ margin: 0, flex: 2 }}>
            <label style={{ fontSize: '12px', marginBottom: '4px', display: 'block' }}>Buscar Producto / SKU</label>
            <input 
              type="text" 
              placeholder="Buscar..." 
              value={filterSearch} 
              onChange={e => setFilterSearch(e.target.value)} 
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {/* Create Inventory Form */}
        {showCreateForm && (
          <form onSubmit={handleCreateInventory} className="crud-form" style={{ marginBottom: '20px', border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
            <h3 style={{ marginTop: 0 }}>Iniciar control de nueva variante</h3>
            <div className="form-grid">
              {isAdmin && (
                <div className="form-group">
                  <label>Sucursal</label>
                  <select required value={createForm.branchId} onChange={e => setCreateForm({...createForm, branchId: Number(e.target.value)})}>
                    <option value="">Seleccione...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}
              {isEncargado && (
                <div className="form-group">
                  <label>Sucursal</label>
                  <input type="text" disabled value="Tu sucursal" />
                </div>
              )}
              <div className="form-group">
                <label>Variante (SKU - Producto)</label>
                <select required value={createForm.variantId} onChange={e => setCreateForm({...createForm, variantId: Number(e.target.value)})}>
                  <option value="">Seleccione...</option>
                  {variants.map(v => <option key={v.id} value={v.id}>{v.sku} - {v.product.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Stock Mnimo</label>
                <input type="number" min="0" required value={createForm.stockMin} onChange={e => setCreateForm({...createForm, stockMin: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label>Stock Mximo (Opcional)</label>
                <input type="number" min="0" value={createForm.stockMax || ''} onChange={e => setCreateForm({...createForm, stockMax: e.target.value ? Number(e.target.value) : 0})} />
              </div>
            </div>
            <button type="submit" className="btn-primary">Crear Registro</button>
          </form>
        )}

        {/* Movement Form */}
        {showMovementForm && (
          <form onSubmit={handleRegisterMovement} className="crud-form" style={{ marginBottom: '20px', border: '1px solid #0056b3', padding: '15px', borderRadius: '8px', backgroundColor: '#f0f7ff' }}>
            <h3 style={{ marginTop: 0, color: '#0056b3' }}>Registrar Movimiento de Stock</h3>
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Inventario Afectado (Sucursal - Variante)</label>
                <select required value={movementForm.inventoryId} onChange={e => setMovementForm({...movementForm, inventoryId: Number(e.target.value)})}>
                  <option value="">Seleccione inventario existente...</option>
                  {inventoryList.filter(inv => isEncargado ? inv.branchId === user?.branchId : true).map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.branch?.name} | {inv.variant?.sku} ({inv.variant?.product.name}) - Stock actual: {inv.stock}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tipo de Movimiento</label>
                <select required value={movementForm.type} onChange={e => setMovementForm({...movementForm, type: e.target.value})}>
                  <option value="ENTRADA">ENTRADA (+)</option>
                  <option value="DEVOLUCION">DEVOLUCION (+)</option>
                  <option value="AJUSTE">AJUSTE (+/-)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Cantidad {movementForm.type === 'AJUSTE' ? '(Use negativos para restar)' : ''}</label>
                <input type="number" required value={movementForm.quantity} onChange={e => setMovementForm({...movementForm, quantity: Number(e.target.value)})} />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Observaciones (Motivo)</label>
                <input type="text" value={movementForm.observation} onChange={e => setMovementForm({...movementForm, observation: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="btn-primary">Ejecutar Movimiento</button>
          </form>
        )}

        {/* Limits Edit Form Modal equivalent */}
        {showLimitsForm && (
          <div style={{ padding: '15px', background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>Editar Lmites - {showLimitsForm.variant?.sku}</h3>
            <form onSubmit={handleUpdateLimits} style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Min</label>
                <input type="number" min="0" value={limitsForm.stockMin} onChange={e => setLimitsForm({...limitsForm, stockMin: Number(e.target.value)})} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Max (Opcional)</label>
                <input type="number" min="0" value={limitsForm.stockMax || ''} onChange={e => setLimitsForm({...limitsForm, stockMax: Number(e.target.value)})} />
              </div>
              <button type="submit" className="btn-primary">Guardar</button>
              <button type="button" className="btn-secondary" onClick={() => setShowLimitsForm(null)}>Cancelar</button>
            </form>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Cargando inventario...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {isAdmin && <th>Sucursal</th>}
                <th>SKU</th>
                <th>Producto / Talla / Color</th>
                <th>Stock Fsico</th>
                <th>Reservado</th>
                <th>Disponible</th>
                <th>Min / Max</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map(inv => {
                const available = inv.stock - inv.reserved;
                return (
                  <tr key={inv.id}>
                    {isAdmin && <td>{inv.branch?.name}</td>}
                    <td><strong>{inv.variant?.sku}</strong></td>
                    <td>{inv.variant?.product.name} <br/> <small>{inv.variant?.size.name} / {inv.variant?.color.name}</small></td>
                    <td>{inv.stock}</td>
                    <td style={{ color: '#d9534f' }}>{inv.reserved}</td>
                    <td style={{ fontWeight: 'bold', color: available > 0 ? '#5cb85c' : '#d9534f' }}>{available}</td>
                    <td>{inv.stockMin} / {inv.stockMax || 'N/A'}</td>
                    <td>{getStockStatus(inv)}</td>
                    <td>
                      <div className="crud-actions">
                        <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => { setShowLimitsForm(inv); setLimitsForm({ stockMin: inv.stockMin, stockMax: inv.stockMax || 0 }); }}>Lmites</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredInventory.length === 0 && (
                <tr><td colSpan={isAdmin ? 9 : 8}><div className="empty-state">No hay registros de inventario.</div></td></tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
