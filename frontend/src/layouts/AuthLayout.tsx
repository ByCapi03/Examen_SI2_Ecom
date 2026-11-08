import { Outlet } from 'react-router-dom';
import '../styles/dashboard.css';

export const AuthLayout = () => {
  return (
    <div className="auth-layout-wrapper">
        <Outlet />
    </div>
  );
};
