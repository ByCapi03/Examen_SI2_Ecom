import { Outlet } from 'react-router-dom';
import { OfflineStatusBar } from '../components/common/OfflineStatusBar';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const StoreLayout = () => {
  return (
    <div className="store-layout">
      <Navbar />
      <main style={{ minHeight: '80vh', padding: '20px' }}>
        <Outlet />
        <OfflineStatusBar />
      </main>
      <Footer />
    </div>
  );
};
