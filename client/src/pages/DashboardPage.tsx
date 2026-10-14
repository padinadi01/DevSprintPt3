import { Link } from 'react-router-dom';
import { getDashboard } from '../api/dashboard';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { cardClass } from '../components/ui';
import { formatDateTime, formatNumber, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function DashboardPage() {
  const { data, error, loading, reload } = useAsyncData(getDashboard);

  return (
    <div>
      <PageHeader title="Dashboard" description="Ringkasan stok dan penjualan warung hari ini." />

      {loading && !data && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total Produk" value={formatNumber(data.totalProducts)} />
            <StatCard label="Total Unit Stok" value={formatNumber(data.totalUnits)} />
            <StatCard label="Penjualan Hari Ini" value={formatRupiah(data.todaySalesTotal)} />
            <StatCard
              label="Produk Stok Rendah"
              value={formatNumber(data.lowStockCount)}
              hint={`Stok ${data.lowStockThreshold} unit atau kurang`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className={cardClass}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Penjualan Terbaru</h2>
                <Link to="/riwayat-penjualan" className="text-sm text-green-700 hover:underline">
                  Lihat semua
                </Link>
              </div>
              {data.latestSales.length === 0 ? (
                <EmptyState title="Belum ada penjualan" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.latestSales.map((sale) => (
                    <li key={sale.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <Link
                          to={`/riwayat-penjualan/${sale.id}`}
                          className="text-sm font-medium text-slate-900 hover:underline"
                        >
                          {sale.invoiceNumber}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {formatDateTime(sale.createdAt)} · {sale.itemCount} item
                        </p>
                      </div>
                      <span className="text-sm font-medium text-slate-900">
                        {formatRupiah(sale.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={cardClass}>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="font-semibold text-slate-900">Stok Rendah</h2>
                <Link to="/produk" className="text-sm text-green-700 hover:underline">
                  Kelola produk
                </Link>
              </div>
              {data.lowStockProducts.length === 0 ? (
                <EmptyState title="Semua stok aman" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {data.lowStockProducts.map((product) => (
                    <li key={product.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500">
                          {product.sku} · {product.category}
                        </p>
                      </div>
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                        {product.stock} unit
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
