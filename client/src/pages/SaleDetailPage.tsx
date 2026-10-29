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
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title={sale ? `Struk: ${sale.invoiceNumber}` : 'Detail Penjualan'}
        description={
          sale
            ? `Waktu transaksi kasir: ${formatDateTime(sale.createdAt)}`
            : 'Rincian produk dan total pembayaran transaksi kasir.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Link to="/riwayat-penjualan" className={btnSecondary}>
              ← Kembali ke Riwayat
            </Link>
            <Link
              to="/penjualan/baru"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
            >
              + Transaksi Baru
            </Link>
          </div>
        }
      />

      {loading && !sale && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {sale && (
        <div className="space-y-6">
          {/* Invoice Summary Box */}
          <div className={`${cardClass} p-5 flex flex-wrap items-center justify-between gap-4`}>
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                Nomor Invoice Penjualan
              </p>
              <p className="text-xl font-black font-mono text-slate-900 dark:text-white mt-0.5">
                {sale.invoiceNumber}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                Total Tagihan Lunas
              </p>
              <p className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatRupiah(sale.total)}
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#10192d] flex items-center justify-between">
              <h2 className="font-bold text-slate-900 dark:text-white">Daftar Item Belanja</h2>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {sale.items.length} macam barang
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={thClass}>Nama Produk</th>
                    <th className={`${thClass} text-right`}>Jumlah</th>
                    <th className={`${thClass} text-right`}>Harga Satuan</th>
                    <th className={`${thClass} text-right`}>Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {sale.items.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                    >
                      <td className={tdClass}>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.productName}
                        </span>
                        {!item.productIsActive && (
                          <span className="ml-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                            Nonaktif
                          </span>
                        )}
                        <span className="ml-2 text-xs font-mono text-slate-400">
                          {item.productSku}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right font-mono font-bold`}>
                        {item.quantity}
                      </td>
                      <td className={`${tdClass} text-right font-mono text-slate-600 dark:text-slate-300`}>
                        {formatRupiah(item.unitPrice)}
                      </td>
                      <td className={`${tdClass} text-right font-mono font-black text-emerald-700 dark:text-emerald-400`}>
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0f172a]">
                    <td colSpan={3} className="px-4 py-3.5 text-right font-bold text-slate-700 dark:text-slate-300 text-sm">
                      Grand Total Pembayaran:
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(sale.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
