import { useCallback, useState } from 'react';
import { listProducts } from '../api/products';
import { listStockMovements } from '../api/stock';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { cardClass, inputClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime, formatNumber } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { StockMovementType } from '../types/api';

const typeStyles: Record<
  StockMovementType,
  { label: string; className: string; sign: string; textColor: string }
> = {
  INITIAL: {
    label: 'Stok Awal',
    className:
      'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    sign: '+',
    textColor: 'text-slate-700 dark:text-slate-300',
  },
  SALE: {
    label: 'Penjualan Kasir',
    className:
      'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-700/60',
    sign: '−',
    textColor: 'text-blue-700 dark:text-blue-400',
  },
  ADJUSTMENT_IN: {
    label: 'Koreksi Masuk (+)',
    className:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60',
    sign: '+',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  ADJUSTMENT_OUT: {
    label: 'Koreksi Keluar (−)',
    className:
      'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/60',
    sign: '−',
    textColor: 'text-amber-700 dark:text-amber-400',
  },
  PROCUREMENT_IN: {
    label: 'Penerimaan Kulakan',
    className:
      'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60',
    sign: '+',
    textColor: 'text-emerald-700 dark:text-emerald-400',
  },
  PROCUREMENT_REJECT: {
    label: 'Retur/Reject',
    className:
      'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-700/60',
    sign: '−',
    textColor: 'text-purple-700 dark:text-purple-400',
  },
};

export function StockHistoryPage() {
  const [productId, setProductId] = useState('');

  const loadProducts = useCallback(() => listProducts(), []);
  const { data: products } = useAsyncData(loadProducts);

  const loadMovements = useCallback(
    () => listStockMovements({ productId: productId || undefined }),
    [productId],
  );
  const { data: movements, error, loading, reload } = useAsyncData(loadMovements);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Riwayat Mutasi Stok"
        description="Kartu stok dan jejak audit (audit trail) setiap pergerakan stok barang masuk, keluar, penjualan, dan penyesuaian fisik."
        actions={
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141d33] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1a2642] transition-all cursor-pointer"
          >
            🔄 Sync Mutasi
          </button>
        }
      />

      <div className="max-w-md">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1.5">
          Filter Produk Spesifik
        </label>
        <select
          className={inputClass}
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          aria-label="Filter produk"
        >
          <option value="">Semua produk ({products?.length || 0} barang)</option>
          {(products ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} ({product.sku})
            </option>
          ))}
        </select>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !movements && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {movements && movements.length === 0 && (
          <EmptyState
            title="Belum ada riwayat mutasi stok"
            description="Perubahan stok barang dari penjualan, kulakan, atau opname akan tercatat di sini."
          />
        )}

        {movements && movements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Waktu</th>
                  <th className={thClass}>Produk</th>
                  <th className={thClass}>Jenis Mutasi</th>
                  <th className={`${thClass} text-right`}>Jumlah</th>
                  <th className={`${thClass} text-right`}>Stok Sebelum</th>
                  <th className={`${thClass} text-right`}>Stok Sesudah</th>
                  <th className={thClass}>Referensi / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {movements.map((movement) => {
                  const style = typeStyles[movement.type];
                  return (
                    <tr
                      key={movement.id}
                      className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                    >
                      <td className={`${tdClass} whitespace-nowrap font-mono text-xs text-slate-500 dark:text-slate-400`}>
                        {formatDateTime(movement.createdAt)}
                      </td>
                      <td className={tdClass}>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {movement.productName}
                        </span>
                        {!movement.productIsActive && (
                          <span className="ml-2 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:border-slate-700">
                            Nonaktif
                          </span>
                        )}
                        <span className="ml-2 text-xs font-mono text-slate-400">
                          {movement.productSku}
                        </span>
                      </td>
                      <td className={tdClass}>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right font-mono font-bold ${style.textColor}`}>
                        {style.sign}
                        {formatNumber(movement.quantity)}
                      </td>
                      <td className={`${tdClass} text-right font-mono text-slate-500 dark:text-slate-400`}>
                        {formatNumber(movement.beforeStock)}
                      </td>
                      <td className={`${tdClass} text-right font-mono font-black text-slate-900 dark:text-white`}>
                        {formatNumber(movement.afterStock)}
                      </td>
                      <td className={`${tdClass} text-xs text-slate-600 dark:text-slate-300 font-medium`}>
                        {movement.referenceLabel ?? movement.note ?? '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
