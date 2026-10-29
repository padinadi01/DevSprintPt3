import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';
import { deleteProduct, listProducts, setProductStatus } from '../api/products';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { ProductFormModal } from '../components/ProductFormModal';
import { StockAdjustmentModal } from '../components/StockAdjustmentModal';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import {
  btnPrimary,
  btnSmall,
  btnSmallDanger,
  cardClass,
  inputClass,
  tableHeadClass,
  tdClass,
  thClass,
} from '../components/ui';
import { LOW_STOCK_THRESHOLD } from '../lib/constants';
import { formatNumber, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/auth';
import type { Product } from '../types/api';

type FormState = { mode: 'create' } | { mode: 'edit'; product: Product } | null;

export function ProductsPage() {
  const toast = useToast();
  const { isPemilik, hasPermission } = useAuth();
  const canManageProducts = isPemilik || hasPermission('MANAGE_PRODUCTS');
  const canViewCost = isPemilik || hasPermission('VIEW_COST');
  const canAdjustStock = isPemilik || hasPermission('ADJUST_STOCK');

  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [formState, setFormState] = useState<FormState>(null);
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Product | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);

  // Wait until the user stops typing before asking the API.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadProducts = useCallback(() => listProducts({ search: query }), [query]);
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteProduct(deleteTarget.id);
      toast.success(`Produk "${deleteTarget.name}" berhasil dihapus.`);
      setDeleteTarget(null);
      reload();
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget) return;
    setChangingStatus(true);
    const newStatus = !statusTarget.isActive;
    try {
      await setProductStatus(statusTarget.id, newStatus);
      toast.success(
        `Produk "${statusTarget.name}" berhasil ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}.`
      );
      setStatusTarget(null);
      reload();
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      setStatusTarget(null);
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalog Produk & Harga"
        description="Kelola daftar produk, harga modal, harga jual eceran, dan status keaktifan produk."
        actions={
          canManageProducts ? (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => setFormState({ mode: 'create' })}
            >
              + Tambah Produk Baru
            </button>
          ) : undefined
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
            placeholder="Cari nama, SKU, atau kategori..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Cari produk"
          />
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !products && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {products && products.length === 0 && (
          <EmptyState
            title={query ? 'Produk tidak ditemukan' : 'Belum ada produk'}
            description={
              query ? 'Coba kata kunci lain.' : 'Tambahkan produk pertama untuk mulai berjualan.'
            }
          />
        )}

        {products && products.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>SKU</th>
                  <th className={thClass}>Nama Produk</th>
                  <th className={thClass}>Kategori</th>
                  {canViewCost && <th className={`${thClass} text-right`}>Modal</th>}
                  <th className={`${thClass} text-right`}>Harga Jual</th>
                  <th className={`${thClass} text-right`}>Sisa Stok</th>
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
                    <td className={`${tdClass} font-bold text-slate-900 dark:text-white`}>
                      {product.name}
                    </td>
                    <td className={tdClass}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {product.category}
                      </span>
                    </td>
                    {canViewCost && (
                      <td className={`${tdClass} text-right font-mono font-bold text-xs text-purple-700 dark:text-purple-300`}>
                        {product.purchasePrice !== undefined ? formatRupiah(product.purchasePrice) : '-'}
                      </td>
                    )}
                    <td className={`${tdClass} text-right font-mono font-black text-emerald-600 dark:text-emerald-400`}>
                      {formatRupiah(product.sellingPrice)}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      <span
                        className={`font-mono ${
                          product.stock <= LOW_STOCK_THRESHOLD
                            ? 'font-black text-rose-600 dark:text-rose-400'
                            : 'font-bold text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {formatNumber(product.stock)}{' '}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          {product.baseUnit}
                        </span>
                      </span>
                    </td>
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
                    <td className={`${tdClass} whitespace-nowrap text-right space-x-1`}>
                      {canManageProducts && (
                        <button
                          type="button"
                          className={`${btnSmall} border border-slate-200 dark:border-slate-700`}
                          onClick={() => setStatusTarget(product)}
                        >
                          {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )}
                      {canAdjustStock && (
                        <button
                          type="button"
                          className={`${btnSmall} border border-slate-200 dark:border-slate-700`}
                          onClick={() => setAdjustTarget(product)}
                        >
                          Stok
                        </button>
                      )}
                      {canManageProducts && (
                        <>
                          <button
                            type="button"
                            className={`${btnSmall} border border-slate-200 dark:border-slate-700 font-bold`}
                            onClick={() => setFormState({ mode: 'edit', product })}
                          >
                            Ubah
                          </button>
                          <button
                            type="button"
                            className={`${btnSmallDanger} border border-rose-200 dark:border-rose-900/50 font-bold`}
                            onClick={() => setDeleteTarget(product)}
                          >
                            Hapus
                          </button>
                        </>
                      )}
                      {!canManageProducts && !canAdjustStock && (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                          Hanya Baca
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

      {formState && (
        <ProductFormModal
          product={formState.mode === 'edit' ? formState.product : null}
          onClose={() => setFormState(null)}
          onSaved={(saved) => {
            toast.success(
              formState.mode === 'edit'
                ? `Produk "${saved.name}" berhasil diperbarui.`
                : `Produk "${saved.name}" berhasil ditambahkan.`,
            );
            setFormState(null);
            reload();
          }}
        />
      )}

      {adjustTarget && (
        <StockAdjustmentModal
          product={adjustTarget}
          onClose={() => setAdjustTarget(null)}
          onSaved={() => {
            toast.success(`Stok "${adjustTarget.name}" berhasil disesuaikan.`);
            setAdjustTarget(null);
            reload();
          }}
        />
      )}

      {statusTarget && (
        <ConfirmDialog
          title={statusTarget.isActive ? 'Nonaktifkan produk?' : 'Aktifkan produk?'}
          message={
            statusTarget.isActive
              ? `Produk "${statusTarget.name}" tidak akan bisa dijual lagi.`
              : `Produk "${statusTarget.name}" akan kembali bisa dijual.`
          }
          confirmLabel={statusTarget.isActive ? 'Nonaktifkan' : 'Aktifkan'}
          busy={changingStatus}
          onConfirm={handleConfirmStatusChange}
          onCancel={() => setStatusTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Hapus produk?"
          message={`Produk "${deleteTarget.name}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Hapus"
          busy={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
