import React, { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PageHeader } from './components/PageHeader';
import { btnSecondary } from './components/ui';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';

// Route-level code splitting: keep LoginPage synchronous so /login renders instantly,
// while lazy-loading internal feature pages on demand.
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const ProductsPage = lazy(() => import('./pages/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage').then((m) => ({ default: m.PurchaseOrdersPage })));
const NewPurchaseOrderPage = lazy(() => import('./pages/NewPurchaseOrderPage').then((m) => ({ default: m.NewPurchaseOrderPage })));
const PurchaseOrderDetailPage = lazy(() => import('./pages/PurchaseOrderDetailPage').then((m) => ({ default: m.PurchaseOrderDetailPage })));
const NewSalePage = lazy(() => import('./pages/NewSalePage').then((m) => ({ default: m.NewSalePage })));
const SalesHistoryPage = lazy(() => import('./pages/SalesHistoryPage').then((m) => ({ default: m.SalesHistoryPage })));
const SaleDetailPage = lazy(() => import('./pages/SaleDetailPage').then((m) => ({ default: m.SaleDetailPage })));
const StockHistoryPage = lazy(() => import('./pages/StockHistoryPage').then((m) => ({ default: m.StockHistoryPage })));
const RbacControlPage = lazy(() => import('./pages/RbacControlPage').then((m) => ({ default: m.RbacControlPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center p-12 text-slate-500">
      <div className="h-7 w-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

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

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="h-9 w-9 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400 font-medium">Memuat sesi Warung Madura...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route
          index
          element={
            <Suspense fallback={<PageFallback />}>
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="stok"
          element={
            <Suspense fallback={<PageFallback />}>
              <InventoryPage />
            </Suspense>
          }
        />
        <Route
          path="produk"
          element={
            <Suspense fallback={<PageFallback />}>
              <ProductsPage />
            </Suspense>
          }
        />
        <Route
          path="pesanan"
          element={
            <Suspense fallback={<PageFallback />}>
              <PurchaseOrdersPage />
            </Suspense>
          }
        />
        <Route
          path="pesanan/baru"
          element={
            <Suspense fallback={<PageFallback />}>
              <NewPurchaseOrderPage />
            </Suspense>
          }
        />
        <Route
          path="pesanan/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <PurchaseOrderDetailPage />
            </Suspense>
          }
        />
        <Route
          path="penjualan/baru"
          element={
            <Suspense fallback={<PageFallback />}>
              <NewSalePage />
            </Suspense>
          }
        />
        <Route
          path="riwayat-penjualan"
          element={
            <Suspense fallback={<PageFallback />}>
              <SalesHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="riwayat-penjualan/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <SaleDetailPage />
            </Suspense>
          }
        />
        <Route
          path="riwayat-stok"
          element={
            <Suspense fallback={<PageFallback />}>
              <StockHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="rbac-control"
          element={
            <Suspense fallback={<PageFallback />}>
              <RbacControlPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
