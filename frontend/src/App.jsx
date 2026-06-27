import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import StaffDashboard from './pages/StaffDashboard';
import POS from './pages/POS';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Customers from './pages/Customers';
import Orders from './pages/Orders';
import Inventory from './pages/Inventory';
import Suppliers from './pages/Suppliers';
import Employees from './pages/Employees';
import Shifts from './pages/Shifts';
import Promotions from './pages/Promotions';
import Reports from './pages/Reports';
import ActivityLogs from './pages/ActivityLogs';
import Warranty from './pages/Warranty';
import WarrantyLookupPublic from './pages/WarrantyLookupPublic';
import SettingsPage from './components/settings/SettingsPage';
import { canAccessPath, getToken, getUser } from './utils/auth';
import { isFullAccessRole } from './utils/auth';

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
      </Routes>
    </BrowserRouter>
  );
}
