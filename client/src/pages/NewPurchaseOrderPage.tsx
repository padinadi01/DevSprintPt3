import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listProducts } from '../api/products';
import { createPurchaseOrder } from '../api/purchase-orders';
import { getSuppliers } from '../api/suppliers';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import { btnPrimary, inputClass } from '../components/ui';
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

  const { data: suppliers, loading: loadingSuppliers, error: errSuppliers, reload: reloadS } = useAsyncData(getSuppliers);
  const { data: products, loading: loadingProducts, error: errProducts, reload: reloadP } = useAsyncData(() => listProducts({ inStock: false }));

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
      toast.success('Pesanan berhasil dibuat!');
      navigate('/pesanan');
    } catch (err: any) {
      toast.error(err.message);
      setIsSubmitting(false);
    }
  };

  const isFormComplete = supplierId && items.length > 0;

  const content = (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="bg-white p-6 rounded shadow space-y-4">
        <h2 className="text-lg font-medium border-b pb-2">Informasi Pesanan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pesan</label>
            <input
              type="datetime-local"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
              placeholder="Contoh: Tolong kirim pagi-pagi"
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow space-y-4">
        <h2 className="text-lg font-medium border-b pb-2">Item Pesanan</h2>

        <div className="flex gap-2">
          <select
            className={inputClass}
            onChange={(e) => {
              handleAddItem(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">+ Tambah Produk</option>
            {activeProducts
              .filter((p: Product) => !items.some((i) => i.productId === p.id))
              .map((p: Product) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
          </select>
        </div>

        {items.length > 0 ? (
          <table className="w-full text-left border-collapse mt-4">
            <thead>
              <tr className="bg-gray-50 border-b border-t">
                <th className="p-2 font-medium text-gray-500">Produk</th>
                <th className="p-2 font-medium text-gray-500">Satuan Beli</th>
                <th className="p-2 font-medium text-gray-500 w-32">Jumlah</th>
                <th className="p-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const product = activeProducts.find((p: Product) => p.id === item.productId);
                if (!product) return null;
                return (
                  <tr key={item.productId} className="border-b">
                    <td className="p-2 font-medium">{product.name}</td>
                    <td className="p-2 text-gray-500">{product.unitOfPurchase}</td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="1"
                        value={item.orderedQty}
                        onChange={(e) => handleUpdateQty(item.productId, parseInt(e.target.value) || 1)}
                        className={inputClass}
                        required
                      />
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="p-4 text-center text-gray-500 bg-gray-50 rounded">
            Belum ada produk yang ditambahkan.
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => navigate('/pesanan')}
          className="px-4 py-2 border rounded font-medium hover:bg-gray-50"
        >
          Batal
        </button>
        <button type="submit" disabled={!isFormComplete || isSubmitting} className={btnPrimary}>
          {isSubmitting ? <span data-nosnippet aria-hidden="true">Menyimpan...</span> : 'Simpan Pesanan'}
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
      {error && <ErrorState message={error} onRetry={() => { reloadS(); reloadP(); }} />}
      {suppliers && products && content}
    </div>
  );
}
