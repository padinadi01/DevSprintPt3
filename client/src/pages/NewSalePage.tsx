import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage, ApiError } from '../api/http';
import { listProducts } from '../api/products';
import { createSale } from '../api/sales';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import {
  btnPrimary,
  btnSecondary,
  btnSmallDanger,
  cardClass,
  inputClass,
  labelClass,
  tableHeadClass,
  tdClass,
  thClass,
} from '../components/ui';
import { formatNumber, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { SaleRequestItem } from '../types/api';

export function NewSalePage() {
  const toast = useToast();
  const navigate = useNavigate();

  // Only products that are in stock can be sold.
  const loadProducts = useCallback(() => listProducts({ inStock: true }), []);
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);

  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cart, setCart] = useState<SaleRequestItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const productsById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products],
  );

  // Prices shown here are for the cashier's information. The server recalculates everything.
  const rows = cart.flatMap((line) => {
    const product = productsById.get(line.productId);
    return product ? [{ line, product, subtotal: product.sellingPrice * line.quantity }] : [];
  });
  const total = rows.reduce((sum, row) => sum + row.subtotal, 0);

  function handleAdd() {
    const product = productsById.get(selectedId);
    const amount = Number(quantity);
    if (!product) {
      toast.error('Pilih produk terlebih dahulu.');
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      toast.error('Jumlah harus berupa bilangan bulat lebih dari 0.');
      return;
    }

    const existing = cart.find((line) => line.productId === product.id);
    const newQuantity = (existing?.quantity ?? 0) + amount;
    if (newQuantity > product.stock) {
      toast.error(`Stok ${product.name} hanya tersedia ${product.stock}.`);
      return;
    }

    setCart((current) =>
      existing
        ? current.map((line) =>
            line.productId === product.id ? { ...line, quantity: newQuantity } : line,
          )
        : [...current, { productId: product.id, quantity: amount }],
    );
    setSelectedId('');
    setQuantity('1');
  }

  function handleChangeQuantity(productId: string, value: string, maxStock: number) {
    const parsed = Math.floor(Number(value));
    const next = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), maxStock) : 1;
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity: next } : line)),
    );
  }

  function handleRemove(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  async function handleSubmit() {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const sale = await createSale(cart);
      toast.success(`Penjualan ${sale.invoiceNumber} berhasil disimpan.`);
      navigate(`/riwayat-penjualan/${sale.id}`);
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      // Stock may have changed since this page was loaded.
      if (caught instanceof ApiError && caught.status === 409) reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Penjualan Baru" description="Pilih produk, isi jumlah, lalu simpan transaksi." />

      {loading && !products && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {products && products.length === 0 && (
        <div className={cardClass}>
          <EmptyState
            title="Tidak ada produk dengan stok tersedia"
            description="Tambahkan produk atau stok barang terlebih dahulu di halaman Produk."
          />
        </div>
      )}

      {products && products.length > 0 && (
        <div className="space-y-6">
          <section className={`${cardClass} p-5`}>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_8rem_auto]">
              <div>
                <label className={labelClass} htmlFor="sale-product">
                  Produk
                </label>
                <select
                  id="sale-product"
                  className={inputClass}
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">Pilih produk...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {formatRupiah(product.sellingPrice)} · stok {product.stock}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="sale-quantity">
                  Jumlah
                </label>
                <input
                  id="sale-quantity"
                  type="number"
                  min={1}
                  step={1}
                  className={inputClass}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <button type="button" className={btnSecondary} onClick={handleAdd}>
                Tambah
              </button>
            </div>
          </section>

          <section className={`${cardClass} overflow-hidden`}>
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-900">Daftar Item</h2>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title="Belum ada item"
                description="Pilih produk di atas lalu klik Tambah."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className={tableHeadClass}>
                    <tr>
                      <th className={thClass}>Produk</th>
                      <th className={`${thClass} text-right`}>Harga</th>
                      <th className={`${thClass} text-right`}>Stok Tersedia</th>
                      <th className={`${thClass} text-right`}>Jumlah</th>
                      <th className={`${thClass} text-right`}>Subtotal</th>
                      <th className={thClass} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map(({ line, product, subtotal }) => (
                      <tr key={line.productId}>
                        <td className={`${tdClass} font-medium text-slate-900`}>{product.name}</td>
                        <td className={`${tdClass} text-right`}>{formatRupiah(product.sellingPrice)}</td>
                        <td className={`${tdClass} text-right`}>{formatNumber(product.stock)}</td>
                        <td className={`${tdClass} text-right`}>
                          <input
                            type="number"
                            min={1}
                            max={product.stock}
                            step={1}
                            aria-label={`Jumlah ${product.name}`}
                            className={`${inputClass} ml-auto w-24 text-right`}
                            value={line.quantity}
                            onChange={(event) =>
                              handleChangeQuantity(line.productId, event.target.value, product.stock)
                            }
                          />
                        </td>
                        <td className={`${tdClass} text-right`}>{formatRupiah(subtotal)}</td>
                        <td className={`${tdClass} text-right`}>
                          <button
                            type="button"
                            className={btnSmallDanger}
                            onClick={() => handleRemove(line.productId)}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
                <p className="text-2xl font-semibold text-slate-900">{formatRupiah(total)}</p>
              </div>
              <button
                type="button"
                className={btnPrimary}
                onClick={handleSubmit}
                disabled={rows.length === 0 || submitting}
              >
                {submitting ? 'Menyimpan...' : 'Simpan Penjualan'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
