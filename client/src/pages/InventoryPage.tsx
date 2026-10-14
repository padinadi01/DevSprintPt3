import { useCallback, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listInventoryChecks, createInventoryCheck } from '../api/inventory';
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
import type { Product } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

function CreateInventoryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{
    productId: string;
    physicalStock: number;
    reason: string;
    notes: string;
  }[]>([]);

  useEffect(() => {
    listProducts({}).then(setProducts).catch(() => {});
  }, []);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        productId: '',
        physicalStock: 0,
        reason: 'HILANG',
        notes: '',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0 || items.some(i => !i.productId || i.physicalStock < 0 || !i.reason)) {
      toast.error('Lengkapi semua item dengan benar.');
      return;
    }

    setSaving(true);
    try {
      await createInventoryCheck({
        notes: notes || undefined,
        items: items.map(i => ({
          ...i,
          notes: i.notes || undefined
        })),
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
      <div className={`${cardClass} w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Stok Opname Baru</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-500">
            Tutup
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Catatan (Opsional)</label>
              <input
                type="text"
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className={labelClass}>Daftar Produk Diperiksa</label>
              <button type="button" onClick={handleAddItem} className={btnSecondary}>
                + Tambah Produk
              </button>
            </div>
            {items.map((item, index) => {
              const selectedProduct = products.find(p => p.id === item.productId);
              return (
                <div key={index} className="flex gap-3 mb-2 items-end border border-slate-200 p-3 rounded">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-700">Produk</label>
                    <select
                      className={inputClass}
                      value={item.productId}
                      onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                      required
                    >
                      <option value="">Pilih Produk</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Sistem: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-700">Stok Fisik</label>
                    <input
                      type="number"
                      className={inputClass}
                      value={item.physicalStock}
                      onChange={(e) => handleItemChange(index, 'physicalStock', Number(e.target.value))}
                      min="0"
                      required
                    />
                  </div>
                  {selectedProduct && (
                    <div className="w-24 px-2 py-2 text-sm">
                      Selisih: {item.physicalStock - selectedProduct.stock}
                    </div>
                  )}
                  <div className="w-40">
                    <label className="block text-xs font-medium text-slate-700">Alasan</label>
                    <select
                      className={inputClass}
                      value={item.reason}
                      onChange={(e) => handleItemChange(index, 'reason', e.target.value)}
                      required
                    >
                      <option value="HILANG">Hilang</option>
                      <option value="RUSAK">Rusak</option>
                      <option value="KADALUARSA">Kadaluarsa</option>
                      <option value="SALAH_INPUT">Salah Input</option>
                      <option value="LAINNYA">Lainnya</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-slate-700">Catatan Item</label>
                    <input
                      type="text"
                      className={inputClass}
                      value={item.notes}
                      onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                    />
                  </div>
                  <button type="button" onClick={() => handleRemoveItem(index)} className={btnDanger}>
                    X
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className={btnSecondary} disabled={saving}>
              Batal
            </button>
            <button type="submit" className={btnPrimary} disabled={saving || items.length === 0}>
              {saving ? 'Menyimpan...' : 'Simpan Opname'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function InventoryPage() {
  const { hasPermission } = useAuth();
  const canCreateInventoryCheck = hasPermission('inventory.create');
  const [showModal, setShowModal] = useState(false);
  const loadChecks = useCallback(() => listInventoryChecks(), []);
  const { data: checks, error, loading, reload } = useAsyncData(loadChecks);
  const toast = useToast();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">DRAFT</span>;
      case 'APPLIED':
        return <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">SELESAI</span>;
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">{status}</span>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Stok Opname"
        description="Periksa dan koreksi stok fisik"
        actions={
          canCreateInventoryCheck && (
          <button type="button" className={btnPrimary} onClick={() => setShowModal(true)}>
            + Stok Opname Baru
          </button>
          )
        }
      />

      <div className={`${cardClass} overflow-hidden`}>
        {loading && !checks && <LoadingState />}
        {error && (
          <div className="p-4">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}

        {checks && checks.length === 0 && (
          <EmptyState
            title="Belum ada riwayat opname"
            description="Mulai stok opname untuk menyesuaikan stok sistem dengan fisik."
          />
        )}

        {checks && checks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className={tableHeadClass}>
                <tr>
                  <th className={thClass}>No. Opname</th>
                  <th className={thClass}>Pemeriksa</th>
                  <th className={`${thClass} text-right`}>Jumlah Item</th>
                  <th className={`${thClass} text-right`}>Total Selisih</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {checks.map((check) => (
                  <tr key={check.id} className="hover:bg-slate-50 cursor-pointer relative">
                    <td className={`${tdClass} font-medium text-blue-600 hover:underline`}>
                      <Link to={`/inventory/${check.id}`} className="absolute inset-0">
                        <span className="sr-only">Detail {check.checkNumber}</span>
                      </Link>
                      {check.checkNumber}
                    </td>
                    <td className={tdClass}>{check.checkedBy}</td>
                    <td className={`${tdClass} text-right`}>{check.itemCount}</td>
                    <td className={`${tdClass} text-right ${check.totalDifference > 0 ? 'text-green-600' : check.totalDifference < 0 ? 'text-red-600' : ''}`}>
                      {check.totalDifference > 0 ? '+' : ''}{check.totalDifference}
                    </td>
                    <td className={tdClass}>{getStatusBadge(check.status)}</td>
                    <td className={tdClass}>{formatDateTime(check.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && canCreateInventoryCheck && (
        <CreateInventoryModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            toast.success('Stok opname berhasil disimpan dan diaplikasikan.');
            reload();
          }}
        />
      )}
    </div>
  );
}
