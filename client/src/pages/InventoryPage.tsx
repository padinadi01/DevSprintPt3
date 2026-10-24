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

  const loadProducts = useCallback(() => listProducts({ search: debouncedSearch }), [debouncedSearch]);
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);



  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaris & Sisa Stok"
        description="Pantau sisa stok barang dalam satuan jual (sachet, bungkus, botol) dan lakukan penyesuaian hitung fisik (Stock Opname)."
      />

      <div className="max-w-sm">
        <input
          type="search"
          className={inputClass}
          placeholder="Cari nama atau SKU produk..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari produk"
        />
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
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>SKU</th>
                  <th className={thClass}>Nama Produk</th>
                  <th className={thClass}>Konversi Kulakan</th>
                  <th className={`${thClass} text-right`}>Sisa Stok (Satuan Jual)</th>
                  {canViewCost && <th className={`${thClass} text-right`}>Modal / Satuan Jual</th>}
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className={`${tdClass} text-slate-500 font-mono text-xs`}>{product.sku}</td>
                    <td className={tdClass}>
                      <span className="font-semibold text-slate-900">{product.name}</span>
                      <span className="ml-2 text-xs text-slate-400">({product.category})</span>
                    </td>
                    <td className={`${tdClass} text-xs text-slate-600`}>
                      1 {product.unitOfPurchase} = {product.unitsPerPurchase} {product.baseUnit}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <span className="text-base font-bold text-blue-700">
                         {formatNumber(product.stock)}{' '}
                        <span className="text-xs font-normal text-slate-600">{product.baseUnit}</span>
                      </span>
                      {product.stockBreakdown && product.unitsPerPurchase > 1 && (
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {product.stockBreakdown}
                        </div>
                      )}
                    </td>
                    {canViewCost && (
                      <td className={`${tdClass} text-right text-xs font-medium text-purple-900`}>
                        {product.purchasePrice !== undefined ? formatRupiah(product.purchasePrice) : '-'}
                      </td>
                    )}
                    <td className={tdClass}>
                      {product.isActive ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {canAdjustStock ? (
                        <button
                          type="button"
                          className={btnSmall}
                          disabled={!product.isActive}
                          onClick={() => setAdjustTarget(product)}
                        >
                          Hitung Fisik / Opname
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Perlu Izin</span>
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
