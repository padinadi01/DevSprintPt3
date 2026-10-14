import { useCallback, useState } from 'react';
import { listProducts } from '../api/products';
import { listStockMovements } from '../api/stock';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { cardClass, inputClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime, formatNumber } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { StockMovementType } from '../types/api';

const typeStyles: Record<StockMovementType, { label: string; className: string; sign: string }> = {
  INITIAL: { label: 'Stok Awal', className: 'bg-slate-100 text-slate-700', sign: '+' },
  SALE: { label: 'Penjualan', className: 'bg-blue-50 text-blue-700', sign: '−' },
  ADJUSTMENT_IN: { label: 'Penyesuaian Masuk', className: 'bg-green-50 text-green-700', sign: '+' },
  ADJUSTMENT_OUT: { label: 'Penyesuaian Keluar', className: 'bg-amber-50 text-amber-700', sign: '−' },
  RESTOCK: { label: 'Restock Masuk', className: 'bg-emerald-50 text-emerald-700', sign: '+' },
  RESTOCK_BONUS: { label: 'Bonus Restock', className: 'bg-purple-50 text-purple-700', sign: '+' },
  DAMAGED_IN: { label: 'Barang Rusak (Masuk)', className: 'bg-red-50 text-red-700', sign: '!' },
  OPNAME_IN: { label: 'Opname (+)', className: 'bg-teal-50 text-teal-700', sign: '+' },
  OPNAME_OUT: { label: 'Opname (−)', className: 'bg-rose-50 text-rose-700', sign: '−' },
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
    <div>
      <PageHeader
        title="Riwayat Stok"
        description="Setiap perubahan stok tercatat di sini, terbaru di atas."
      />

      <div className="mb-4 max-w-sm">
        <select
          className={inputClass}
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
          aria-label="Filter produk"
        >
          <option value="">Semua produk</option>
          {(products ?? []).map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
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
          <EmptyState title="Belum ada riwayat stok" />
        )}

        {movements && movements.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Waktu</th>
                  <th className={thClass}>Produk</th>
                  <th className={thClass}>Jenis</th>
                  <th className={`${thClass} text-right`}>Jumlah</th>
                  <th className={`${thClass} text-right`}>Stok Sebelum</th>
                  <th className={`${thClass} text-right`}>Stok Sesudah</th>
                  <th className={thClass}>Referensi / Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.map((movement) => {
                  const style = typeStyles[movement.type];
                  return (
                    <tr key={movement.id} className="hover:bg-slate-50">
                      <td className={`${tdClass} whitespace-nowrap`}>{formatDateTime(movement.createdAt)}</td>
                      <td className={tdClass}>
                        <span className="font-medium text-slate-900">{movement.productName}</span>
                        {!movement.productIsActive && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            Nonaktif
                          </span>
                        )}
                        <span className="ml-2 text-xs text-slate-400">{movement.productSku}</span>
                      </td>
                      <td className={tdClass}>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style.className}`}>
                          {style.label}
                        </span>
                      </td>
                      <td className={`${tdClass} text-right font-medium`}>
                        {style.sign}
                        {formatNumber(movement.quantity)}
                      </td>
                      <td className={`${tdClass} text-right`}>{formatNumber(movement.beforeStock)}</td>
                      <td className={`${tdClass} text-right`}>{formatNumber(movement.afterStock)}</td>
                      <td className={`${tdClass} text-slate-600`}>
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
