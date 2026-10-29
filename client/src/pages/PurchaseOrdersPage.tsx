import { Link } from 'react-router-dom';
import { getPurchaseOrders } from '../api/purchase-orders';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { btnPrimary, cardClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/auth';

function getStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600/50';
    case 'PARTIALLY_RECEIVED':
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/50';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-600/50';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-600/50';
  }
}

export function PurchaseOrdersPage() {
  const { isPemilik, hasPermission } = useAuth();
  const canCreatePo = isPemilik || hasPermission('CREATE_PO');
  const { data: pos, error, loading, reload } = useAsyncData(getPurchaseOrders);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pesanan Pembelian (PO)"
        description="Daftar pemesanan barang kulakan ke supplier beserta status penerimaan fisik."
        actions={
          canCreatePo ? (
            <Link to="/pesanan/baru" className={btnPrimary}>
              + Buat Pesanan Baru
            </Link>
          ) : undefined
        }
      />

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !pos && <LoadingState />}
        {error && <ErrorState message={error} onRetry={reload} />}

        {pos && pos.length === 0 && (
          <EmptyState
            title="Belum ada pesanan pembelian"
            description="Buat pesanan kulakan ke supplier untuk mulai menambah stok toko."
            action={
              canCreatePo ? (
                <Link to="/pesanan/baru" className={btnPrimary}>
                  Buat Pesanan Pertama
                </Link>
              ) : undefined
            }
          />
        )}

        {pos && pos.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Tanggal Pesan</th>
                  <th className={thClass}>Supplier</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Catatan</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {pos.map((po) => (
                  <tr
                    key={po.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                  >
                    <td className={`${tdClass} text-slate-500 dark:text-slate-400 font-mono text-xs`}>
                      {formatDateTime(po.orderDate)}
                    </td>
                    <td className={`${tdClass} font-bold text-slate-900 dark:text-white`}>
                      {po.supplierName}
                    </td>
                    <td className={tdClass}>
                      <span
                        className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full border ${getStatusBadge(
                          po.status,
                        )}`}
                      >
                        {po.status}
                      </span>
                    </td>
                    <td className={`${tdClass} text-slate-500 dark:text-slate-400 text-xs italic`}>
                      {po.note || '-'}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <Link
                        to={`/pesanan/${po.id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:underline"
                      >
                        Lihat Detail & Terima →
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
