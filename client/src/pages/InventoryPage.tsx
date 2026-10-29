import { useCallback, useEffect, useState } from 'react';
import { listProducts } from '../api/products';
import { PageHeader } from '../components/PageHeader';
import { StockAdjustmentModal } from '../components/StockAdjustmentModal';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import { btnSmall, cardClass, inputClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatNumber, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/auth';
import type { Product } from '../types/api';

export function InventoryPage() {
  const toast = useToast();
  const { isPemilik, hasPermission } = useAuth();
  const canViewCost = isPemilik || hasPermission('VIEW_COST');
  const canAdjustStock = isPemilik || hasPermission('ADJUST_STOCK');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 200);
    return () => clearTimeout(timer);
  }, [search]);

  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);

  const loadProducts = useCallback(
    () => listProducts({ search: debouncedSearch }),
    [debouncedSearch],
  );
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaris & Sisa Stok"
        description="Pantau sisa stok barang dalam satuan jual (sachet, bungkus, botol) dan lakukan penyesuaian hitung fisik (Stock Opname)."
        actions={
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141d33] text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1a2642] transition-all cursor-pointer"
          >
            🔄 Sync Stok
          </button>
        }
      />

      <div className="max-w-md">
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            🔍
          </span>
          <input
            type="search"
            className={`${inputClass} pl-10`}
            placeholder="Cari nama produk, SKU, atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari produk"
          />
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !products && <LoadingState />}
        {error && <ErrorState message={error} onRetry={reload} />}

        {products && products.length === 0 && (
          <EmptyState
            title="Produk tidak ditemukan"
            description="Tidak ada data produk yang cocok dengan pencarian."
          />
        )}

        {products && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>SKU</th>
                  <th className={thClass}>Nama Produk</th>
                  <th className={thClass}>Konversi Kulakan</th>
                  <th className={`${thClass} text-right`}>Sisa Stok (Satuan Jual)</th>
                  {canViewCost && <th className={`${thClass} text-right`}>Modal / Satuan</th>}
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {products.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                  >
                    <td className={`${tdClass} text-slate-500 dark:text-slate-400 font-mono text-xs font-semibold`}>
                      {product.sku}
                    </td>
                    <td className={tdClass}>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {product.name}
                      </span>
                      <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {product.category}
                      </span>
                    </td>
                    <td className={`${tdClass} text-xs text-slate-600 dark:text-slate-300 font-medium`}>
                      1 {product.unitOfPurchase} = {product.unitsPerPurchase} {product.baseUnit}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatNumber(product.stock)}{' '}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {product.baseUnit}
                        </span>
                      </span>
                      {product.stockBreakdown && product.unitsPerPurchase > 1 && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          {product.stockBreakdown}
                        </div>
                      )}
                    </td>
                    {canViewCost && (
                      <td className={`${tdClass} text-right text-xs font-mono font-bold text-purple-700 dark:text-purple-300`}>
                        {product.purchasePrice !== undefined ? formatRupiah(product.purchasePrice) : '-'}
                      </td>
                    )}
                    <td className={tdClass}>
                      {product.isActive ? (
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/80 dark:border-emerald-600/50 dark:text-emerald-300">
                          Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {canAdjustStock ? (
                        <button
                          type="button"
                          className={`${btnSmall} border border-slate-200 dark:border-slate-700 font-bold`}
                          disabled={!product.isActive}
                          onClick={() => setAdjustTarget(product)}
                        >
                          Hitung Fisik / Opname
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                          Perlu Izin
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {adjustTarget && (
        <StockAdjustmentModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => {
            toast.success(`Stok fisik "${adjustTarget.name}" berhasil disesuaikan!`);
            setAdjustTarget(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
