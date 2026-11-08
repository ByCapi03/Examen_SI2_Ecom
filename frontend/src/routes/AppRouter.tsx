import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Layouts
import { StoreLayout } from '../layouts/StoreLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { ClientAccountLayout } from '../layouts/ClientAccountLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';

import { ROL } from '../types/roles';

// Auth Pages
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import { ActivateAccountPage } from '../features/auth/ActivateAccountPage';
import { ChangePasswordPage } from '../features/auth/ChangePasswordPage';
// Store Pages
import { HomePage } from '../features/home/HomePage';
import { CatalogPage } from '../features/catalog/CatalogPage';
import { ProductDetailPage } from '../features/catalog/ProductDetailPage';
import { BranchesPage } from '../features/branches/BranchesPage';
import { CreateReservationPage } from '../features/reservations/CreateReservationPage';
import { CartPage } from '../features/cart/CartPage';
import { TryOnPage } from '../features/try-on/TryOnPage';
import { CheckoutPage } from '../features/cart/CheckoutPage';
import { QrPaymentPage } from '../features/reservations/QrPaymentPage';

// Account Pages
import { AccountProfile } from '../features/account/AccountProfile';
import { ReservationsPage } from '../features/reservations/ReservationsPage';
import { PurchasesPage } from '../features/account/PurchasesPage';
import { PurchaseDetailPage } from '../features/account/PurchaseDetailPage';

// Backoffice Pages
import { DashboardPage } from '../features/home/DashboardPage';
import { ProductsAdminPage } from '../features/catalog/ProductsAdminPage';
import { InventoryAdminPage } from '../features/inventory/InventoryAdminPage';
import { ReservationsAdminPage } from '../features/reservations/ReservationsAdminPage';
import { SalesAdminPage } from '../features/sales/SalesAdminPage';
import { PosDashboardPage } from '../features/sales/PosDashboardPage';
import { PosTerminalPage } from '../features/sales/PosTerminalPage';
import { CashSessionsAdminPage } from '../features/sales/CashSessionsAdminPage';
import { UsersPage } from '../features/dashboard/UsersPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SuppliersPage } from '../features/suppliers/SuppliersPage';

export const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/activate-account" element={<ActivateAccountPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        {/* Public QR Payment Page */}
        <Route path="/qr-payment/:token" element={<QrPaymentPage />} />

        {/* Store Routes (Customer Facing) */}
        <Route path="/" element={<StoreLayout />}>
          <Route index element={<HomePage />} />
          <Route path="catalog" element={<CatalogPage />} />
          <Route path="products/:id" element={<ProductDetailPage />} />
          <Route path="try-on/:variantId" element={<TryOnPage />} />
          <Route path="reservations/new" element={<CreateReservationPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route element={<ProtectedRoute allowedRoles={[ROL.CLIENTE]}/>}>
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="checkout/success" element={<CheckoutPage />} />
          </Route>
        </Route>

        {/* Client Account Routes */}
        <Route 
          path="/account" 
          element={
            <ProtectedRoute allowedRoles={[ROL.CLIENTE]} />
          }
        >
          <Route element={<ClientAccountLayout />}>
            <Route index element={<AccountProfile />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="purchases" element={<PurchasesPage />} />
            <Route path="purchases/:id" element={<PurchaseDetailPage />} />
          </Route>
        </Route>

        {/* Dashboard Routes (Internal Personnel) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                ROL.ADMIN,
                ROL.ENCARGADO,
                ROL.CAJERO
              ]}
            />
          }
        >
          <Route element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="products" element={<ProductsAdminPage />} />
            <Route path="inventory" element={<InventoryAdminPage />} />
            <Route path="branches" element={<BranchesPage />} />
            <Route path="reservations" element={<ReservationsAdminPage />} />
            <Route path="sales" element={<SalesAdminPage />} />
            <Route path="pos" element={<PosDashboardPage />} />
            <Route path="pos/terminal" element={<PosTerminalPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="cash-sessions" element={<CashSessionsAdminPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="suppliers" element={<SuppliersPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
