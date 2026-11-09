import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './features/auth/AuthContext';
import { CartProvider } from './features/cart/CartContext';
import { PwaNotifier } from './components/common/PwaNotifier';
import { SettingsProvider } from './config/SettingsContext';
import { PlanProvider } from './features/saas/PlanContext';

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <PlanProvider>
          <CartProvider>
            <PwaNotifier />
            <AppRouter />
          </CartProvider>
        </PlanProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
