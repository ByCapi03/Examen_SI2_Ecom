import { AppRouter } from './routes/AppRouter';
import { AuthProvider } from './features/auth/AuthContext';
import { PwaNotifier } from './components/common/PwaNotifier';
import { SettingsProvider } from './config/SettingsContext';
import { PlanProvider } from './features/saas/PlanContext';

function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <PlanProvider>
          <PwaNotifier />
          <AppRouter />
        </PlanProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}

export default App;
