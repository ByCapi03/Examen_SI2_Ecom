import { NavLink, useNavigate } from 'react-router-dom';
import { DASHBOARD_NAVIGATION } from '../config/navigation';
import { useAuth } from '../features/auth/AuthContext';
import { LogOut, LayoutDashboard, Calendar, Box, Package, Users, ShoppingCart, DollarSign } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  '/dashboard': <LayoutDashboard size={20} />,
  '/dashboard/reservations': <Calendar size={20} />,
  '/dashboard/inventory': <Box size={20} />,
  '/dashboard/products': <Package size={20} />,
  '/dashboard/users': <Users size={20} />,
  '/dashboard/sales': <ShoppingCart size={20} />,
  '/dashboard/cash-sessions': <DollarSign size={20} />,
};

export const DashboardSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter navigation items based on the user's role
  const allowedNavItems = DASHBOARD_NAVIGATION.filter(item => 
    user?.roles?.some(role => item.allowedRoles.includes(role as any))
  );

  return (
    <div className="dashboard-sidebar">
      <div className="sidebar-brand">
        <h3>ATEMPORAL</h3>
      </div>
      <nav className="sidebar-nav">
        {allowedNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) => 
              isActive ? 'sidebar-link active' : 'sidebar-link'
            }
          >
            {iconMap[item.path]}
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>
      
      <div className="sidebar-logout">
        <button onClick={handleLogout}>
          <LogOut size={20} />
          <span>Salir</span>
        </button>
      </div>

    </div>
  );
};
