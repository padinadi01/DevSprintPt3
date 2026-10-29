import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api/dashboard';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { cardClass, btnPrimary, btnSecondary } from '../components/ui';
import { formatDateTime, formatNumber, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/auth';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: string;
  trendColor?: string;
}

function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className={`${cardClass} p-5 flex flex-col justify-between group hover:border-emerald-500/50 transition-all duration-150`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <span className="text-xl p-2 rounded-xl bg-slate-100 dark:bg-[#141e35] shrink-0">
          {icon}
        </span>
      </div>
      <div className="mt-3">
        <p className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
          {value}
        </p>
        {hint && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user, isPemilik, hasPermission, quickSwitch } = useAuth();
  const canViewDashboard = isPemilik || hasPermission('VIEW_DASHBOARD');

  const loadDashboard = useCallback(async () => {
    if (!canViewDashboard) return null;
    return getDashboard();
  }, [canViewDashboard]);

  const { data, error, loading, reload } = useAsyncData(loadDashboard);

  if (!canViewDashboard) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard Finansial"
          description="Ringkasan omset dan analitik stok (Khusus Pemilik / Izin VIEW_DASHBOARD)."
        />
        <div className={`${cardClass} p-8 text-center max-w-lg mx-auto space-y-4`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-950/60 dark:border dark:border-amber-800">
            🔒
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Akses Dibatasi (403 Forbidden)
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Halaman Dashboard memuat informasi omset harian dan data finansial yang bersifat rahasia. Sesuai aturan RBAC, halaman ini hanya dapat diakses oleh akun <strong>PEMILIK</strong> atau Staf yang telah diberi izin akses <code>VIEW_DASHBOARD</code>.
          </p>
          <div className="rounded-xl bg-slate-50 dark:bg-[#121a2d] p-3 text-xs text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 font-mono">
            Status Akun Saat Ini: <strong className="text-slate-800 dark:text-slate-200">{user ? `${user.name} (${user.role})` : 'Tamu (Belum Login)'}</strong>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => quickSwitch('pemilik')}
              className={btnPrimary}
            >
              👑 Beralih ke Cak Rofi (Pemilik)
            </button>
            <Link to="/stok" className={btnSecondary}>
              Ke Inventaris Stok
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Ringkasan"
        description="Ringkasan penjualan harian, status inventaris stok, dan peringatan barang menipis."
        actions={
          <button
            type="button"
            onClick={reload}
            className={`${btnSecondary} text-xs`}
            title="Muat ulang data dashboard"
          >
            🔄 Segarkan
          </button>
        }
      />

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="space-y-6">
          {/* Key Metric Stat Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total Produk"
              value={formatNumber(data.totalProducts)}
              icon="🏷️"
              hint="Katalog aktif dalam sistem"
            />
            <StatCard
              label="Total Unit Stok"
              value={formatNumber(data.totalUnits)}
              icon="📦"
              hint="Akumulasi satuan jual"
            />
            <StatCard
              label="Penjualan Hari Ini"
              value={formatRupiah(data.todaySalesTotal)}
              icon="💰"
              hint="Omset kotor transaksi hari ini"
            />
            <StatCard
              label="Produk Stok Rendah"
              value={formatNumber(data.lowStockCount)}
              icon="⚠️"
              hint={`Stok ${data.lowStockThreshold} unit atau kurang`}
            />
          </div>

          {/* Detailed Lists Grid */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Latest Sales */}
            <section className={`${cardClass} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🧾</span>
                  <h2 className="font-bold text-slate-900 dark:text-white">Penjualan Terbaru</h2>
                </div>
                <Link
                  to="/riwayat-penjualan"
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:underline"
                >
                  Lihat Semua →
                </Link>
              </div>

              {data.latestSales.length === 0 ? (
                <EmptyState title="Belum ada transaksi hari ini" />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {data.latestSales.map((sale) => (
                    <li
                      key={sale.id}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                    >
                      <div>
                        <Link
                          to={`/riwayat-penjualan/${sale.id}`}
                          className="text-sm font-bold text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 transition-colors"
                        >
                          {sale.invoiceNumber}
                        </Link>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formatDateTime(sale.createdAt)} · {sale.itemCount} barang
                        </p>
                      </div>
                      <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(sale.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Low Stock Alert */}
            <section className={`${cardClass} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <h2 className="font-bold text-slate-900 dark:text-white">Stok Perlu Kulakan</h2>
                </div>
                <Link
                  to="/produk"
                  className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:underline"
                >
                  Kelola Produk →
                </Link>
              </div>

              {data.lowStockProducts.length === 0 ? (
                <div className="p-8 text-center space-y-1">
                  <span className="text-3xl block">✅</span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Semua Stok Aman
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada produk yang berada di bawah batas minimum stok.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {data.lowStockProducts.map((product) => (
                    <li
                      key={product.id}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {product.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {product.sku} · {product.category}
                        </p>
                      </div>
                      <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-950/80 dark:border-rose-800/80 dark:text-rose-300 font-mono">
                        Sisa {product.stock}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
