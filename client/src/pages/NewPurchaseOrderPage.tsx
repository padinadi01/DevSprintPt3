import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '../api/products';
import { createPurchaseOrder } from '../api/purchase-orders';
import { getSuppliers } from '../api/suppliers';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
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
import { useAsyncData } from '../lib/useAsyncData';
import type { Product } from '../types/api';

interface OrderItemState {
  productId: string;
  orderedQty: number;
}

export function NewPurchaseOrderPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [note, setNote] = useState('');
  const [items, setItems] = useState<OrderItemState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: suppliers,
    loading: loadingSuppliers,
    error: errSuppliers,
    reload: reloadS,
  } = useAsyncData(getSuppliers);
  const {
    data: products,
    loading: loadingProducts,
    error: errProducts,
    reload: reloadP,
  } = useAsyncData(() => listProducts({ inStock: false }));

  const activeProducts = products?.filter((p: Product) => p.isActive) || [];

  const handleAddItem = (productId: string) => {
    if (!productId) return;
    if (items.some((i) => i.productId === productId)) return;
    setItems([...items, { productId, orderedQty: 1 }]);
  };

  const handleRemoveItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    if (qty < 1) return;
    setItems(items.map((i) => (i.productId === productId ? { ...i, orderedQty: qty } : i)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || items.length === 0) return;

    setIsSubmitting(true);
    try {
      await createPurchaseOrder({
        supplierId,
        orderDate: new Date(orderDate).toISOString(),
        note: note || undefined,
        items,
      });
      toast.success('Pesanan pembelian berhasil dibuat!');
      navigate('/pesanan');
    } catch (err: any) {
      toast.error(err.message);
      setIsSubmitting(false);
    }
  };

  const isFormComplete = Boolean(supplierId && items.length > 0);

  const content = (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`${cardClass} p-6 space-y-4`}>
        <h2 className="text-base font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
          Informasi Pesanan & Supplier
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supplier <span className="text-red-500">*</span></label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">-- Pilih Supplier --</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tanggal Pesan <span className="text-red-500">*</span></label>
            <input
              type="datetime-local"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Catatan Pesanan (Opsional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Contoh: Tolong kirim pagi hari, via kurir langganan"
            />
          </div>
        </div>
      </div>

      <div className={`${cardClass} p-6 space-y-4`}>
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Daftar Item Pesanan
          </h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {items.length} item dipilih
          </span>
        </div>

        <div className="max-w-md">
          <select
            className={inputClass}
            onChange={(e) => {
              handleAddItem(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">+ Tambah Produk ke Pesanan...</option>
            {activeProducts
              .filter((p: Product) => !items.some((i) => i.productId === p.id))
              .map((p: Product) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) · 1 {p.unitOfPurchase}
                </option>
              ))}
          </select>
        </div>

        {items.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>Nama Produk</th>
                  <th className={thClass}>Satuan Beli</th>
                  <th className={`${thClass} w-36`}>Jumlah Dipesan</th>
                  <th className={`${thClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {items.map((item) => {
                  const product = activeProducts.find((p: Product) => p.id === item.productId);
                  if (!product) return null;
                  return (
                    <tr
                      key={item.productId}
                      className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                    >
                      <td className={`${tdClass} font-bold text-slate-900 dark:text-white`}>
                        {product.name}{' '}
                        <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
                          ({product.sku})
                        </span>
                      </td>
                      <td className={`${tdClass} text-xs text-slate-600 dark:text-slate-300 font-medium`}>
                        {product.unitOfPurchase} ({product.unitsPerPurchase} {product.baseUnit})
                      </td>
                      <td className={tdClass}>
                        <input
                          type="number"
                          min="1"
                          value={item.orderedQty}
                          onChange={(e) =>
                            handleUpdateQty(item.productId, parseInt(e.target.value, 10) || 1)
                          }
                          className={`${inputClass} text-center font-mono font-bold w-24`}
                          required
                        />
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.productId)}
                          className={btnSmallDanger}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#10192d] rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <span className="text-3xl block mb-1 opacity-50">📋</span>
            <p className="text-sm font-semibold">Belum ada produk yang ditambahkan.</p>
            <p className="text-xs">Pilih produk pada dropdown di atas untuk memasukkan barang kulakan.</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate('/pesanan')}
          className={btnSecondary}
        >
          Batal
        </button>
        <button type="submit" disabled={!isFormComplete || isSubmitting} className={btnPrimary}>
          {isSubmitting ? (
            <span data-nosnippet aria-hidden="true" className="inline-flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Menyimpan Pesanan...</span>
            </span>
          ) : (
            'Simpan Pesanan'
          )}
        </button>
      </div>
    </form>
  );

  const error = errSuppliers || errProducts;
  const loading = loadingSuppliers || loadingProducts;

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Buat Pesanan Baru"
        description="Masukkan barang yang ingin dipesan ke supplier (belum menambah stok)."
      />
      {loading && (!suppliers || !products) && <LoadingState />}
      {error && (
        <ErrorState
          message={error}
          onRetry={() => {
            reloadS();
            reloadP();
          }}
        />
      )}
      {suppliers && products && content}
    </div>
  );
}
