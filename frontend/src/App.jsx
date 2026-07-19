import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import {
  canAccessPath,
  getToken,
  getUser,
  isFullAccessRole
} from './utils/auth';
import SessionSecurity from './components/SessionSecurity';
import NetworkStatus from './components/NetworkStatus';
import PageLoading from './components/PageLoading';

const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const POS = lazy(() => import('./pages/POS'));
const ProductManagement = lazy(() => import('./pages/ProductManagement'));
const Categories = lazy(() => import('./pages/Categories'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const Inventory = lazy(() => import('./pages/inventory/InventoryPage'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'));
const Employees = lazy(() => import('./pages/Employees'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Reports = lazy(() => import('./pages/Reports'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const Warranty = lazy(() => import('./pages/Warranty'));
const WarrantyLookupPublic = lazy(() => import('./pages/WarrantyLookupPublic'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PageLoader() {
  return <PageLoading message="Đang tải dữ liệu trang" fullScreen />;
}

function ProtectedRoute() {
  const token = getToken();
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function PermissionRoute() {
  const user = getUser();
  const pathname = window.location.pathname;

  return canAccessPath(pathname, user) ? <Outlet /> : <AccessDenied />;
}

function AccessDenied() {
  useEffect(() => { toast.error('Bạn không có quyền truy cập chức năng này'); }, []);
  return <Navigate to="/pos" replace />;
}

function HomePage() {
  const user = getUser();
  return isFullAccessRole(user?.role) ? <Dashboard /> : <StaffDashboard />;
}

export default function App() {
  return (
    <NetworkStatus>
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
      <Toaster position="top-right" />
      <SessionSecurity />
      <Suspense fallback={<PageLoader />}>
       <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tra-cuu-bao-hanh/:publicToken" element={<WarrantyLookupPublic />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<PermissionRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/products" element={<ProductManagement />} />
            <Route path="/products/promotions" element={<ProductManagement />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/purchase-orders" element={<PurchaseOrders />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/revenue" element={<Employees />} />
            <Route path="/employees/shifts" element={<Employees />} />
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/promotions" element={<Navigate to="/products/promotions" replace />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/warranties" element={<Warranty />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/inventory/purchase-orders" element={<Inventory />} />
            <Route path="/inventory/history" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/print" element={<SettingsPage />} />
            <Route path="/settings/payment" element={<SettingsPage />} />
            <Route path="/settings/inventory" element={<SettingsPage />} />
            <Route path="/settings/security" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
       </Routes>
      </Suspense>
    </BrowserRouter>
    </NetworkStatus>
  );
}
