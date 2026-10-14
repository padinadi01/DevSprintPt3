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
import type { Product } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

type FormState = { mode: 'create' } | { mode: 'edit'; product: Product } | null;

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const canManageProducts = hasPermission('products.manage');
  const canViewCost = hasPermission('product.cost.view');
  const canAdjustStock = hasPermission('stock.adjust');
  const toast = useToast();
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
    <div>
      <PageHeader
        title="Produk"
        description="Kelola daftar produk, harga, dan stok."
        actions={
          canManageProducts && canViewCost && (
          <button type="button" className={btnPrimary} onClick={() => setFormState({ mode: 'create' })}>
            Tambah Produk
          </button>
          )
        }
      />

      <div className="mb-4 max-w-sm">
        <input
          type="search"
          className={inputClass}
          placeholder="Cari nama, SKU, atau kategori..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Cari produk"
        />
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
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>SKU</th>
                  <th className={thClass}>Nama</th>
                  <th className={thClass}>Kategori</th>
                  {canViewCost && <th className={`${thClass} text-right`}>Harga Modal</th>}
                  <th className={`${thClass} text-right`}>Harga Jual</th>
                  <th className={`${thClass} text-right`}>Stok</th>
                  <th className={thClass}>Status</th>
                  {(canManageProducts || canAdjustStock) && <th className={`${thClass} text-right`}>Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50">
                    <td className={`${tdClass} text-slate-500`}>{product.sku}</td>
                    <td className={`${tdClass} font-medium text-slate-900`}>{product.name}</td>
                    <td className={tdClass}>{product.category}</td>
                    {canViewCost && <td className={`${tdClass} text-right`}>{formatRupiah(product.purchasePrice ?? 0)}</td>}
                    <td className={`${tdClass} text-right`}>{formatRupiah(product.sellingPrice)}</td>
                    <td className={`${tdClass} text-right`}>
                      <span
                        className={
                          product.stock <= LOW_STOCK_THRESHOLD
                            ? 'font-semibold text-red-600'
                            : 'text-slate-900'
                        }
                      >
                        {formatNumber(product.stock)}
                      </span>
                    </td>
                    <td className={tdClass}>
                      {product.isActive ? (
                        <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                          Aktif
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Nonaktif
                        </span>
                      )}
                    </td>
                    {(canManageProducts || canAdjustStock) && <td className={`${tdClass} whitespace-nowrap text-right`}>
                      {canManageProducts && <>
                      <button
                        type="button"
                        className={btnSmall}
                        onClick={() => setStatusTarget(product)}
                      >
                        {product.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      </>}
                      {canAdjustStock && <>
                      <button
                        type="button"
                        className={btnSmall}
                        onClick={() => setAdjustTarget(product)}
                      >
                        Stok
                      </button>
                      </>}
                      {canManageProducts && <>
                      <button
                        type="button"
                        className={btnSmall}
                        onClick={() => setFormState({ mode: 'edit', product })}
                      >
                        Ubah
                      </button>
                      <button
                        type="button"
                        className={btnSmallDanger}
                        onClick={() => setDeleteTarget(product)}
                      >
                        Hapus
                      </button>
                      </>}
                    </td>}
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

      {adjustTarget && canAdjustStock && (
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
              ? `Produk "${statusTarget.name}" akan tetap tersimpan beserta riwayatnya, tetapi tidak dapat dijual sampai diaktifkan kembali.`
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
          message={`Produk "${deleteTarget.name}" akan dihapus. Produk dengan riwayat transaksi atau pergerakan stok tidak dapat dihapus.`}
          confirmLabel="Hapus"
          busy={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
