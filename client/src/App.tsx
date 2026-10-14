import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { PageHeader } from './components/PageHeader';
import { btnSecondary } from './components/ui';
import { useAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { NewPurchaseOrderPage } from './pages/NewPurchaseOrderPage';
import { NewSalePage } from './pages/NewSalePage';
import { ProductsPage } from './pages/ProductsPage';
import { PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { SaleDetailPage } from './pages/SaleDetailPage';
import { SalesHistoryPage } from './pages/SalesHistoryPage';
import { StockHistoryPage } from './pages/StockHistoryPage';
import { RbacControlPage } from './pages/RbacControlPage';

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
        <Route index element={<DashboardPage />} />
        <Route path="stok" element={<InventoryPage />} />
        <Route path="produk" element={<ProductsPage />} />
        <Route path="pesanan" element={<PurchaseOrdersPage />} />
        <Route path="pesanan/baru" element={<NewPurchaseOrderPage />} />
        <Route path="pesanan/:id" element={<PurchaseOrderDetailPage />} />
        <Route path="penjualan/baru" element={<NewSalePage />} />
        <Route path="riwayat-penjualan" element={<SalesHistoryPage />} />
        <Route path="riwayat-penjualan/:id" element={<SaleDetailPage />} />
        <Route path="riwayat-stok" element={<StockHistoryPage />} />
        <Route path="rbac-control" element={<RbacControlPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
