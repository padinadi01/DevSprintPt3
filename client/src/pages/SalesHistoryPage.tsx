import { Link } from 'react-router-dom';
import { listSales } from '../api/sales';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { cardClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';

export function SalesHistoryPage() {
  const { data: sales, error, loading, reload } = useAsyncData(listSales);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Penjualan"
        description="Semua transaksi penjualan kasir yang telah selesai, diurutkan dari yang terbaru."
        actions={
          <Link
            to="/penjualan/baru"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
          >
            + Transaksi Baru (Kasir)
          </Link>
        }
      />

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !sales && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {sales && sales.length === 0 && (
          <EmptyState
            title="Belum ada transaksi penjualan"
            description="Transaksi penjualan akan otomatis tercatat di sini setelah transaksi kasir diselesaikan."
          />
        )}

        {sales && sales.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>No. Invoice</th>
                  <th className={thClass}>Waktu Transaksi</th>
                  <th className={`${thClass} text-right`}>Jumlah Item</th>
                  <th className={`${thClass} text-right`}>Total Transaksi</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {sales.map((sale) => (
                  <tr
                    key={sale.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                  >
                    <td className={`${tdClass} font-mono font-bold text-slate-900 dark:text-white`}>
                      <Link
                        to={`/riwayat-penjualan/${sale.id}`}
                        className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                      >
                        {sale.invoiceNumber}
                      </Link>
                    </td>
                    <td className={`${tdClass} text-xs text-slate-500 dark:text-slate-400 font-mono`}>
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className={`${tdClass} text-right font-mono font-semibold`}>
                      {sale.itemCount} barang
                    </td>
                    <td className={`${tdClass} text-right font-mono font-black text-emerald-700 dark:text-emerald-400`}>
                      {formatRupiah(sale.total)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link
                        to={`/riwayat-penjualan/${sale.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:underline"
                      >
                        Lihat Struk →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
