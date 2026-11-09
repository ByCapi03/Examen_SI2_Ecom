import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './features/auth/AuthContext';
import { CartProvider } from './features/cart/CartContext';
import { PwaNotifier } from './components/common/PwaNotifier';
import { SettingsProvider } from './config/SettingsContext';
import { PlanProvider } from './features/saas/PlanContext';
import { BranchScopeProvider } from './features/branches/BranchScopeContext';

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <PlanProvider>
          <BranchScopeProvider>
            <CartProvider>
              <PwaNotifier />
              <AppRouter />
            </CartProvider>
          </BranchScopeProvider>
        </PlanProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
