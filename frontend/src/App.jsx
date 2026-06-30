import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { canAccessPath, getToken, getUser } from './utils/auth';
import { isFullAccessRole } from './utils/auth';

const Layout = lazy(() => import('./components/Layout'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const StaffDashboard = lazy(() => import('./pages/StaffDashboard'));
const POS = lazy(() => import('./pages/POS'));
const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const Customers = lazy(() => import('./pages/Customers'));
const Orders = lazy(() => import('./pages/Orders'));
const Inventory = lazy(() => import('./pages/inventory/InventoryPage'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Employees = lazy(() => import('./pages/Employees'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Promotions = lazy(() => import('./pages/Promotions'));
const Reports = lazy(() => import('./pages/Reports'));
const ActivityLogs = lazy(() => import('./pages/ActivityLogs'));
const Warranty = lazy(() => import('./pages/Warranty'));
const WarrantyLookupPublic = lazy(() => import('./pages/WarrantyLookupPublic'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));

function PageLoader() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm font-medium text-slate-600">Đang tải Z-TECH POS...</main>;
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
    <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
      <Toaster position="top-right" />
      <Suspense fallback={<PageLoader />}>
       <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/tra-cuu-bao-hanh/:publicToken" element={<WarrantyLookupPublic />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route element={<PermissionRoute />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/products" element={<Products />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/warranties" element={<Warranty />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/activity-logs" element={<ActivityLogs />} />
            <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={getToken() ? "/" : "/login"} replace />} />
       </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
