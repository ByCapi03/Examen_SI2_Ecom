import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './features/auth/AuthContext';
import { CartProvider } from './features/cart/CartContext';
import { PwaNotifier } from './components/common/PwaNotifier';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <PwaNotifier />
        <AppRouter />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
