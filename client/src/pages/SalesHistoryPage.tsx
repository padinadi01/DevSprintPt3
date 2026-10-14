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
    <div>
      <PageHeader title="Riwayat Penjualan" description="Semua transaksi penjualan, terbaru di atas." />

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !sales && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {sales && sales.length === 0 && (
          <EmptyState title="Belum ada penjualan" description="Transaksi akan muncul di sini setelah ada penjualan." />
        )}

        {sales && sales.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>No. Invoice</th>
                  <th className={thClass}>Tanggal</th>
                  <th className={`${thClass} text-right`}>Jumlah Item</th>
                  <th className={`${thClass} text-right`}>Total</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50">
                    <td className={`${tdClass} font-medium text-slate-900`}>{sale.invoiceNumber}</td>
                    <td className={tdClass}>{formatDateTime(sale.createdAt)}</td>
                    <td className={`${tdClass} text-right`}>{sale.itemCount}</td>
                    <td className={`${tdClass} text-right`}>{formatRupiah(sale.total)}</td>
                    <td className={`${tdClass} text-right`}>
                      <Link
                        to={`/riwayat-penjualan/${sale.id}`}
                        className="text-green-700 hover:underline"
                      >
                        Lihat detail
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
