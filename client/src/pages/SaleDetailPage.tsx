import { useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSale } from '../api/sales';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { btnSecondary, cardClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';

export function SaleDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const loadSale = useCallback(() => getSale(id), [id]);
  const { data: sale, error, loading, reload } = useAsyncData(loadSale);

  return (
    <div>
      <PageHeader
        title={sale ? sale.invoiceNumber : 'Detail Penjualan'}
        description={sale ? formatDateTime(sale.createdAt) : undefined}
        actions={
          <Link to="/riwayat-penjualan" className={btnSecondary}>
            Kembali
          </Link>
        }
      />

      {loading && !sale && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {sale && (
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Produk</th>
                  <th className={`${thClass} text-right`}>Jumlah</th>
                  <th className={`${thClass} text-right`}>Harga Satuan</th>
                  <th className={`${thClass} text-right`}>Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item) => (
                  <tr key={item.id}>
                    <td className={tdClass}>
                      <span className="font-medium text-slate-900">{item.productName}</span>
                      {!item.productIsActive && (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                          Nonaktif
                        </span>
                      )}
                      <span className="ml-2 text-xs text-slate-400">{item.productSku}</span>
                    </td>
                    <td className={`${tdClass} text-right`}>{item.quantity}</td>
                    <td className={`${tdClass} text-right`}>{formatRupiah(item.unitPrice)}</td>
                    <td className={`${tdClass} text-right`}>{formatRupiah(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-4">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <span className="text-xl font-semibold text-slate-900">{formatRupiah(sale.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
