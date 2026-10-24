import React, { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PageHeader } from './components/PageHeader';
import { btnSecondary } from './components/ui';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { SeoHead } from './components/SeoHead';

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
    <div data-nosnippet aria-hidden="true" className="flex items-center justify-center p-12 text-slate-500">
      <div className="h-7 w-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div>
      <SeoHead title="Halaman Tidak Ditemukan" description="Halaman tidak ditemukan." noindex={true} />
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
      <div data-nosnippet aria-hidden="true" className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
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
              <SeoHead
                title="Dashboard Ringkasan"
                description="Dashboard ringkasan finansial dan stok warung."
                noindex={true}
              />
              <DashboardPage />
            </Suspense>
          }
        />
        <Route
          path="stok"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Katalog Stok Produk"
                description="Manajemen inventaris stok barang."
                noindex={true}
              />
              <InventoryPage />
            </Suspense>
          }
        />
        <Route
          path="produk"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Master Data Produk"
                description="Pengaturan katalog produk dan harga."
                noindex={true}
              />
              <ProductsPage />
            </Suspense>
          }
        />
        <Route
          path="pesanan"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Surat Pesanan Pembelian"
                description="Daftar surat pesanan barang ke supplier."
                noindex={true}
              />
              <PurchaseOrdersPage />
            </Suspense>
          }
        />
        <Route
          path="pesanan/baru"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Buat Pesanan Baru"
                description="Formulir pemesanan barang ke supplier."
                noindex={true}
              />
              <NewPurchaseOrderPage />
            </Suspense>
          }
        />
        <Route
          path="pesanan/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Detail Surat Pesanan"
                description="Detail penerimaan dan status pesanan pembelian."
                noindex={true}
              />
              <PurchaseOrderDetailPage />
            </Suspense>
          }
        />
        <Route
          path="penjualan/baru"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Kasir Penjualan"
                description="Point of Sale kasir transaksi penjualan 24 jam."
                noindex={true}
              />
              <NewSalePage />
            </Suspense>
          }
        />
        <Route
          path="riwayat-penjualan"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Riwayat Penjualan"
                description="Histori struk dan transaksi kasir."
                noindex={true}
              />
              <SalesHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="riwayat-penjualan/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Detail Transaksi Penjualan"
                description="Detail faktur dan item penjualan kasir."
                noindex={true}
              />
              <SaleDetailPage />
            </Suspense>
          }
        />
        <Route
          path="riwayat-stok"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Riwayat Mutasi Stok"
                description="Audit log kartu mutasi stok masuk dan keluar."
                noindex={true}
              />
              <StockHistoryPage />
            </Suspense>
          }
        />
        <Route
          path="rbac-control"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Master Control Hak Akses & Karyawan"
                description="Pengaturan role staf dan izin akses warung."
                noindex={true}
              />
              <RbacControlPage />
            </Suspense>
          }
        />
        <Route
          path="master-control"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Master Control Hak Akses & Karyawan"
                description="Pengaturan role staf dan izin akses warung."
                noindex={true}
              />
              <RbacControlPage />
            </Suspense>
          }
        />
        <Route
          path="settings/users"
          element={
            <Suspense fallback={<PageFallback />}>
              <SeoHead
                title="Master Control Hak Akses & Karyawan"
                description="Pengaturan role staf dan izin akses warung."
                noindex={true}
              />
              <RbacControlPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
