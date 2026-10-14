import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listRestockOrders, createRestockOrder } from '../api/restock';
import { listSuppliers } from '../api/suppliers';
import { listProducts } from '../api/products';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import { getErrorMessage } from '../api/http';
import {
  btnPrimary,
  btnSecondary,
  btnDanger,
  cardClass,
  inputClass,
  labelClass,
  tableHeadClass,
  tdClass,
  thClass,
} from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { Supplier, Product } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

function CreateRestockModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{
    productId: string;
    quantityOrdered: number;
    unitName: string;
    piecesPerUnit: number;
    purchasePrice: number;
  }[]>([]);

  useEffect(() => {
    listSuppliers().then(setSuppliers).catch(() => {});
    listProducts({}).then(setProducts).catch(() => {});
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        quantityOrdered: 1,
        unitName: 'PCS',
        piecesPerUnit: 1,
        purchasePrice: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      if (product) {
        newItems[index].purchasePrice = product.purchasePrice ?? 0;
      }
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Pilih supplier terlebih dahulu.');
      return;
    }
    if (items.length === 0 || items.some(i => !i.productId || i.quantityOrdered <= 0)) {
      toast.error('Lengkapi semua item pesanan.');
      return;
    }

    setSaving(true);
    try {
      await createRestockOrder({
        supplierId,
        notes: notes || undefined,
        items,
      });
      onSaved();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-900/50 p-4">
      <div className={`${cardClass} w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Buat Pesanan Restock</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-500">
            Tutup
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Supplier</label>
            <select
              className={inputClass}
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              <option value="">-- Pilih Supplier --</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Catatan (Opsional)</label>
            <textarea
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className={labelClass}>Item Pesanan</label>
              <button type="button" onClick={handleAddItem} className={btnSecondary}>
                + Tambah Item
              </button>
            </div>
            {items.map((item, index) => (
              <div key={index} className="flex gap-2 mb-2 items-end border border-slate-200 p-2 rounded">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-700">Produk</label>
                  <select
                    className={inputClass}
                    value={item.productId}
                    onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                    required
                  >
                    <option value="">Pilih</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-slate-700">Qty</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={item.quantityOrdered}
                    onChange={(e) => handleItemChange(index, 'quantityOrdered', Number(e.target.value))}
                    min="1"
                    required
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-slate-700">Satuan</label>
                  <input
                    type="text"
                    className={inputClass}
                    value={item.unitName}
                    onChange={(e) => handleItemChange(index, 'unitName', e.target.value)}
                    required
                  />
                </div>
                <div className="w-20">
                  <label className="block text-xs font-medium text-slate-700">Isi</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={item.piecesPerUnit}
                    onChange={(e) => handleItemChange(index, 'piecesPerUnit', Number(e.target.value))}
                    min="1"
                    required
                  />
                </div>
                <div className="w-32">
                  <label className="block text-xs font-medium text-slate-700">Harga (Rp)</label>
                  <input
                    type="number"
                    className={inputClass}
                    value={item.purchasePrice}
                    onChange={(e) => handleItemChange(index, 'purchasePrice', Number(e.target.value))}
                    min="0"
                    required
                  />
                </div>
                <button type="button" onClick={() => handleRemoveItem(index)} className={btnDanger}>
                  X
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className={btnSecondary} disabled={saving}>
              Batal
            </button>
            <button type="submit" className={btnPrimary} disabled={saving || items.length === 0}>
              {saving ? 'Menyimpan...' : 'Simpan Pesanan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RestockPage() {
  const { hasPermission } = useAuth();
  const canCreateRestock = hasPermission('restock.create') && hasPermission('product.cost.view');
  const [showModal, setShowModal] = useState(false);
  const loadOrders = useCallback(() => listRestockOrders(), []);
  const { data: orders, error, loading, reload } = useAsyncData(loadOrders);
  const toast = useToast();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-medium text-yellow-800">PENDING</span>;
      case 'PARTIAL':
        return <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">PARTIAL</span>;
      case 'COMPLETED':
        return <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">COMPLETED</span>;
      case 'CANCELLED':
        return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">CANCELLED</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">{status}</span>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Restock Barang"
        description="Kelola pesanan dan penerimaan barang dari supplier"
        actions={
          canCreateRestock && (
          <button type="button" className={btnPrimary} onClick={() => setShowModal(true)}>
            + Pesanan Baru
          </button>
          )
        }
      />

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !orders && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {orders && orders.length === 0 && (
          <EmptyState
            title="Belum ada pesanan restock"
            description="Mulai buat pesanan ke supplier untuk mengisi stok."
          />
        )}

        {orders && orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>No. Pesanan</th>
                  <th className={thClass}>Supplier</th>
                  <th className={`${thClass} text-right`}>Jumlah Item</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Tanggal Pesan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 cursor-pointer relative">
                    <td className={`${tdClass} font-medium text-blue-600 hover:underline`}>
                      <Link to={`/restock/${order.id}`} className="absolute inset-0">
                        <span className="sr-only">Detail {order.orderNumber}</span>
                      </Link>
                      {order.orderNumber}
                    </td>
                    <td className={tdClass}>{order.supplierName}</td>
                    <td className={`${tdClass} text-right`}>{order.itemCount}</td>
                    <td className={tdClass}>{getStatusBadge(order.status)}</td>
                    <td className={tdClass}>{formatDateTime(order.orderedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && canCreateRestock && (
        <CreateRestockModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            toast.success('Pesanan berhasil dibuat.');
            reload();
          }}
        />
      )}
    </div>
  );
}
