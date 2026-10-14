import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Layout } from './components/Layout';
import { PageHeader } from './components/PageHeader';
import { btnSecondary } from './components/ui';
import { useAuth } from './contexts/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { NewSalePage } from './pages/NewSalePage';
import { ProductsPage } from './pages/ProductsPage';
import { SaleDetailPage } from './pages/SaleDetailPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { StockHistoryPage } from './pages/StockHistoryPage';

import { RestockPage } from './pages/RestockPage';
import { RestockDetailPage } from './pages/RestockDetailPage';
import { InventoryPage } from './pages/InventoryPage';
import { InventoryDetailPage } from './pages/InventoryDetailPage';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { AccessPage } from './pages/AccessPage';

function NotFoundPage() {
  return (
    <div>
      <PageHeader title="Halaman tidak ditemukan" description="Alamat yang kamu buka tidak tersedia." />
      <Link to="/" className={btnSecondary}>
        Kembali ke Dashboard
      </Link>
    </div>
  );
}

function Authenticated() {
  const { user, loading, setupRequired } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-8 text-sm text-slate-500">Memeriksa sesi...</div>;
  if (!user) return <Navigate to={setupRequired ? '/setup' : '/login'} state={{ from: location }} replace />;
  return <Outlet />;
}

function NeedPermission({ permission, children }: { permission: string | string[]; children: ReactNode }) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const allowed = Array.isArray(permission)
    ? hasAnyPermission(permission)
    : hasPermission(permission);
  if (allowed) return children;
  return (
    <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      Akses ditolak. Hubungi Pemilik jika kamu membutuhkan izin untuk fitur ini.
    </div>
  );
}

function DashboardRedirect() {
  const { hasPermission } = useAuth();
  if (hasPermission('dashboard.view')) return <DashboardPage />;
  const firstAllowedPath = [
    ['products.view', '/produk'],
    ['sales.create', '/penjualan/baru'],
    ['sales.view.own', '/riwayat-penjualan'],
    ['stock.view', '/riwayat-stok'],
    ['restock.view', '/restock'],
    ['inventory.view', '/inventory'],
    ['users.manage', '/pengaturan/akses'],
  ].find(([permission]) => hasPermission(permission));
  return <Navigate to={firstAllowedPath?.[1] ?? '/login'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route element={<Authenticated />}>
        <Route element={<Layout />}>
          <Route index element={<DashboardRedirect />} />
          <Route path="produk" element={<NeedPermission permission="products.view"><ProductsPage /></NeedPermission>} />
          <Route path="penjualan/baru" element={<NeedPermission permission="sales.create"><NewSalePage /></NeedPermission>} />
          <Route path="riwayat-penjualan" element={<NeedPermission permission={['sales.view.all', 'sales.view.own']}><SalesHistoryPage /></NeedPermission>} />
          <Route path="riwayat-penjualan/:id" element={<NeedPermission permission={['sales.view.all', 'sales.view.own']}><SaleDetailPage /></NeedPermission>} />
          <Route path="riwayat-stok" element={<NeedPermission permission="stock.view"><StockHistoryPage /></NeedPermission>} />
          <Route path="restock" element={<NeedPermission permission="restock.view"><RestockPage /></NeedPermission>} />
          <Route path="restock/:id" element={<NeedPermission permission="restock.view"><RestockDetailPage /></NeedPermission>} />
          <Route path="inventory" element={<NeedPermission permission="inventory.view"><InventoryPage /></NeedPermission>} />
          <Route path="inventory/:id" element={<NeedPermission permission="inventory.view"><InventoryDetailPage /></NeedPermission>} />
          <Route path="pengaturan/akses" element={<NeedPermission permission={['users.manage', 'roles.manage']}><AccessPage /></NeedPermission>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
