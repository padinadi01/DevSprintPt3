import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRestockOrder, cancelRestockOrder, createRestockReceipt } from '../api/restock';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
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
import { formatDateTime, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { RestockOrderDetail } from '../types/api';
import { useAuth } from '../contexts/AuthContext';

function ReceiptModal({ order, onClose, onSaved }: { order: RestockOrderDetail; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const unfulfilledItems = order.items.filter(item => item.quantityOrdered > item.quantityReceived);

  const [receiptItems, setReceiptItems] = useState(
    unfulfilledItems.map(item => ({
      restockOrderItemId: item.id,
      quantityGood: item.quantityOrdered - item.quantityReceived,
      quantityDamaged: 0,
      quantityBonus: 0,
      notes: ''
    }))
  );

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...receiptItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceiptItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Filter items that have at least some quantity received
    const validItems = receiptItems.filter(i => i.quantityGood > 0 || i.quantityDamaged > 0 || i.quantityBonus > 0);
    if (validItems.length === 0) {
      toast.error('Tidak ada barang yang diterima.');
      return;
    }

    setSaving(true);
    try {
      await createRestockReceipt(order.id, {
        idempotencyKey,
        notes: notes || undefined,
        items: validItems
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
          <h3 className="text-lg font-semibold text-slate-900">Terima Barang</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-500">Tutup</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Catatan Penerimaan</label>
              <input
                type="text"
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Detail Penerimaan per Item</label>
            {unfulfilledItems.map((orderItem, index) => {
              const rItem = receiptItems[index];
              return (
                <div key={orderItem.id} className="border border-slate-200 p-3 mb-2 rounded bg-slate-50">
                  <div className="font-medium text-slate-900 mb-2">{orderItem.productName} (Sisa: {orderItem.quantityOrdered - orderItem.quantityReceived} {orderItem.unitName})</div>
                  <div className="flex gap-4">
                    <div className="w-24">
                      <label className="block text-xs font-medium text-slate-700">Kondisi Baik</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={rItem.quantityGood}
                        onChange={(e) => handleItemChange(index, 'quantityGood', Number(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-slate-700">Rusak</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={rItem.quantityDamaged}
                        onChange={(e) => handleItemChange(index, 'quantityDamaged', Number(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-medium text-slate-700">Bonus</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={rItem.quantityBonus}
                        onChange={(e) => handleItemChange(index, 'quantityBonus', Number(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-slate-700">Catatan</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={rItem.notes}
                        onChange={(e) => handleItemChange(index, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className={btnSecondary} disabled={saving}>Batal</button>
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Penerimaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function RestockDetailPage() {
  const { hasPermission } = useAuth();
  const canCancelRestock = hasPermission('restock.cancel');
  const canReceiveRestock = hasPermission('restock.receive');
  const canViewCost = hasPermission('product.cost.view');
  const { id = '' } = useParams<{ id: string }>();
  const loadOrder = useCallback(() => getRestockOrder(id), [id]);
  const { data: order, error, loading, reload } = useAsyncData(loadOrder);
  const toast = useToast();

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;
    setCancelling(true);
    try {
      await cancelRestockOrder(id);
      toast.success('Pesanan berhasil dibatalkan.');
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const isPendingOrPartial = order?.status === 'PENDING' || order?.status === 'PARTIAL';

  return (
    <div>
      <PageHeader
        title={order ? `Pesanan: ${order.orderNumber}` : 'Detail Restock'}
        actions={
          <Link to="/restock" className={btnSecondary}>
            Kembali
          </Link>
        }
      />

      {loading && !order && <LoadingState />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {order && (
        <div className="space-y-6">
          <div className={`${cardClass} p-5 flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4`}>
            <div>
              <p className="text-sm text-slate-500">Supplier</p>
              <p className="font-semibold text-slate-900">{order.supplierName}</p>
              <p className="text-sm text-slate-500 mt-2">Tanggal Pesan</p>
              <p className="text-slate-900">{formatDateTime(order.orderedAt)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <p className="font-semibold text-slate-900">{order.status}</p>
              {order.notes && (
                <>
                  <p className="text-sm text-slate-500 mt-2">Catatan</p>
                  <p className="text-slate-900">{order.notes}</p>
                </>
              )}
            </div>
            {isPendingOrPartial && (canCancelRestock || canReceiveRestock) && (
              <div className="flex gap-2">
                {canCancelRestock && <button type="button" className={btnDanger} onClick={handleCancel} disabled={cancelling}>
                  Batalkan Pesanan
                </button>}
                {canReceiveRestock && <button type="button" className={btnPrimary} onClick={() => setShowReceiptModal(true)}>
                  Terima Barang
                </button>}
              </div>
            )}
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Item Dipesan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className={tableHeadClass}>
                  <tr>
                    <th className={thClass}>Produk</th>
                    <th className={`${thClass} text-right`}>Dipesan</th>
                    <th className={`${thClass} text-right`}>Diterima</th>
                    <th className={thClass}>Satuan</th>
                    {canViewCost && <th className={`${thClass} text-right`}>Harga Modal</th>}
                    <th className={thClass}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className={tdClass}>
                        <div className="font-medium text-slate-900">{item.productName}</div>
                        <div className="text-xs text-slate-500">{item.productSku}</div>
                      </td>
                      <td className={`${tdClass} text-right`}>{item.quantityOrdered}</td>
                      <td className={`${tdClass} text-right`}>{item.quantityReceived}</td>
                      <td className={tdClass}>{item.unitName} (isi {item.piecesPerUnit})</td>
                      {canViewCost && <td className={`${tdClass} text-right`}>{formatRupiah(item.purchasePrice ?? 0)}</td>}
                      <td className={tdClass}>{item.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {order.receipts.length > 0 && (
            <div className={`${cardClass} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-900">Riwayat Penerimaan</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {order.receipts.map(receipt => (
                  <div key={receipt.id} className="p-5">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="font-medium">{receipt.receiptNumber}</span>
                        <span className="text-sm text-slate-500 ml-3">{formatDateTime(receipt.receivedAt)}</span>
                      </div>
                      <div className="text-sm text-slate-600">Penerima: {receipt.receivedBy}</div>
                    </div>
                    {receipt.notes && <p className="text-sm text-slate-600 mb-3">Catatan: {receipt.notes}</p>}

                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Produk</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Baik</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Rusak</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Bonus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receipt.items.map(rItem => (
                          <tr key={rItem.id}>
                            <td className="px-3 py-2 text-slate-900">{rItem.productName}</td>
                            <td className="px-3 py-2 text-right text-slate-900">{rItem.quantityGood}</td>
                            <td className="px-3 py-2 text-right text-red-600">{rItem.quantityDamaged > 0 ? rItem.quantityDamaged : 0}</td>
                            <td className="px-3 py-2 text-right text-blue-600">{rItem.quantityBonus > 0 ? rItem.quantityBonus : 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {showReceiptModal && order && canReceiveRestock && (
        <ReceiptModal
          order={order}
          onClose={() => setShowReceiptModal(false)}
          onSaved={() => {
            setShowReceiptModal(false);
            toast.success('Penerimaan barang berhasil disimpan.');
            reload();
          }}
        />
      )}
    </div>
  );
}
