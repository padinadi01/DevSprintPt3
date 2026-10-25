import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createGoodsReceipt } from '../api/goods-receipts';
import { cancelPurchaseOrder, getPurchaseOrder } from '../api/purchase-orders';
import { getReceivers } from '../api/receivers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import { btnPrimary, btnSecondary, cardClass, inputClass, tableHeadClass, tdClass, thClass } from '../components/ui';
import { formatDateTime } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import { useAuth } from '../lib/auth';

interface ReceiptLineInput {
  productId: string;
  productName: string;
  unitOfPurchase: string;
  goodQty: number;
  bonusQty: number;
  rejectedQty: number;
  rejectedReason: string;
}

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user, isPemilik, hasPermission } = useAuth();
  const canCancelPo = isPemilik || hasPermission('CANCEL_PO');
  const canViewCost = isPemilik || hasPermission('VIEW_COST');

  const loadPo = useCallback(() => getPurchaseOrder(id!), [id]);
  const { data: po, error, loading, reload } = useAsyncData(loadPo);
  const { data: receivers } = useAsyncData(getReceivers);

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [receiverId, setReceiverId] = useState('');
  const [receiptNote, setReceiptNote] = useState('');
  const [receiptLines, setReceiptLines] = useState<ReceiptLineInput[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    reload();
  }, [user]);

  const handleConfirmCancel = async () => {
    if (!po) return;
    setCancelling(true);
    try {
      await cancelPurchaseOrder(po.id, 'Dibatalkan oleh pemilik (sisa barang tidak dikirim)');
      toast.success('Pesanan berhasil dibatalkan. Sisa barang yang belum dikirim dianggap batal.');
      setShowCancelDialog(false);
      reload();
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan pesanan.');
    } finally {
      setCancelling(false);
    }
  };

  const openModal = () => {
    if (!po?.items) return;
    setReceiverId(user?.receiverId || '');
    setReceiptNote('');
    setReceiptLines(
      po.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitOfPurchase: item.unitOfPurchase,
        goodQty: item.remainingQty, // default to remaining
        bonusQty: 0,
        rejectedQty: 0,
        rejectedReason: '',
      }))
    );
    setShowReceiveModal(true);
  };

  const handleLineChange = (productId: string, field: keyof ReceiptLineInput, value: any) => {
    setReceiptLines((prev) =>
      prev.map((line) => (line.productId === productId ? { ...line, [field]: value } : line))
    );
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId) {
      toast.error('Penerima barang wajib dipilih (Udin atau Sari).');
      return;
    }

    const itemsToSubmit = receiptLines
      .filter((l) => l.goodQty > 0 || l.bonusQty > 0 || l.rejectedQty > 0)
      .map((l) => ({
        productId: l.productId,
        receivedQty: Number(l.goodQty) || 0,
        goodQty: Number(l.goodQty) || 0,
        bonusQty: Number(l.bonusQty) || 0,
        rejectedQty: Number(l.rejectedQty) || 0,
        rejectedReason: l.rejectedReason.trim() || undefined,
      }));

    if (itemsToSubmit.length === 0) {
      toast.error('Minimal harus ada 1 barang yang diterima atau ditolak.');
      return;
    }

    // Check rejection quantity and reason requirement
    for (const item of itemsToSubmit) {
      if (item.rejectedQty > item.goodQty) {
        toast.error('Jumlah ditolak tidak boleh lebih besar dari jumlah diterima.');
        return;
      }
      if (item.rejectedQty > 0 && !item.rejectedReason) {
        toast.error('Alasan tolak wajib diisi untuk barang yang ditolak.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      // Idempotency: generate unique key
      const idempotencyKey = crypto.randomUUID();

      await createGoodsReceipt({
        purchaseOrderId: po!.id,
        receiverId,
        idempotencyKey,
        note: receiptNote || undefined,
        items: itemsToSubmit,
      });

      toast.success('Penerimaan barang berhasil dicatat! Stok telah diperbarui.');
      setShowReceiveModal(false);
      reload();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan penerimaan barang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !po) return <LoadingState />;
  if (error || !po) return <ErrorState message={error || 'Pesanan tidak ditemukan'} onRetry={reload} />;

  const statusBadge = (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        po.status === 'COMPLETED'
          ? 'bg-green-100 text-green-800'
          : po.status === 'PARTIALLY_RECEIVED'
          ? 'bg-amber-100 text-amber-800'
          : po.status === 'CANCELLED'
          ? 'bg-red-100 text-red-800'
          : 'bg-blue-100 text-blue-800'
      }`}
    >
      {po.status === 'COMPLETED'
        ? 'Selesai'
        : po.status === 'PARTIALLY_RECEIVED'
        ? 'Diterima Sebagian'
        : po.status === 'CANCELLED'
        ? 'Dibatalkan'
        : 'Open (Menunggu)'}
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pesanan: ${po.supplierName}`}
        description={`Dibuat pada ${formatDateTime(po.orderDate)}`}
        actions={
          <div className="flex items-center gap-3">
            <Link to="/pesanan" className={btnSecondary}>
              Kembali
            </Link>
            {po.status !== 'COMPLETED' && po.status !== 'CANCELLED' && (
              <>
                {canCancelPo && (
                  <button
                    type="button"
                    onClick={() => setShowCancelDialog(true)}
                    className="rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Batalkan Pesanan
                  </button>
                )}
                <button type="button" onClick={openModal} className={btnPrimary}>
                  Terima Barang
                </button>
              </>
            )}
          </div>
        }
      />

      {/* PO Summary Card */}
      <div className={`${cardClass} p-5 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
          <div>
            <span className="text-sm text-slate-500">Supplier: </span>
            <span className="font-semibold text-slate-900">{po.supplierName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Status: </span>
            {statusBadge}
          </div>
        </div>
        {po.note && (
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-700">Catatan:</span> {po.note}
          </p>
        )}
      </div>

      {/* Items Table: Ordered vs Received vs Remaining */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-800">Daftar Barang Pesanan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Produk</th>
                <th className={thClass}>Satuan</th>
                <th className={`${thClass} text-right`}>Dipesan</th>
                <th className={`${thClass} text-right`}>Diterima</th>
                <th className={`${thClass} text-right`}>Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {po.items?.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className={tdClass}>
                    <p className="font-medium text-slate-900">{item.productName}</p>
                    <p className="text-xs text-slate-400">{item.productSku}</p>
                  </td>
                  <td className={tdClass}>{item.unitOfPurchase}</td>
                  <td className={`${tdClass} text-right font-medium`}>{item.orderedQty}</td>
                  <td className={`${tdClass} text-right font-medium text-green-700`}>{item.receivedQty}</td>
                  <td className={`${tdClass} text-right font-semibold ${item.remainingQty > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {item.remainingQty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipts History */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-4 border-b bg-slate-50">
          <h2 className="font-semibold text-slate-800">Riwayat Penerimaan Fisik (Goods Receipt)</h2>
        </div>
        {po.receipts && po.receipts.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {po.receipts.map((receipt) => (
              <div key={receipt.id} className="p-4 space-y-2 hover:bg-slate-50">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-semibold text-slate-900">{formatDateTime(receipt.receivedAt)}</span>
                    <span className="mx-2 text-slate-300">•</span>
                    <span className="text-slate-600">Diterima oleh: <strong>{receipt.receiverName}</strong></span>
                  </div>
                  {receipt.note && <span className="text-xs text-slate-500 italic">"{receipt.note}"</span>}
                </div>
                <div className="pl-4 border-l-2 border-green-400 text-xs text-slate-700 space-y-1">
                  {receipt.items.map((i) => (
                    <div key={i.id} className="flex gap-4">
                      <span className="font-medium text-slate-800">{i.productName}:</span>
                      {i.isBonus ? (
                        <span className="text-purple-700 font-semibold">Bonus: {i.receivedQty} {i.unitOfPurchase}</span>
                      ) : (
                        <span>
                          Masuk: <strong>{i.receivedQty - i.rejectedQty}</strong> {i.unitOfPurchase}
                          {i.rejectedQty > 0 && (
                            <span className="ml-2 text-red-600">
                              (Ditolak: {i.rejectedQty} {i.unitOfPurchase} - "{i.rejectedReason}")
                            </span>
                          )}
                        </span>
                      )}
                      {canViewCost && i.unitCostPerBaseUnit !== undefined && (
                        <span className="text-slate-400">
                          (Modal: Rp {i.unitCostPerBaseUnit.toLocaleString('id-ID')}/satuan jual)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-sm text-slate-500">
            Belum ada barang yang diterima untuk pesanan ini.
          </div>
        )}
      </div>

      {/* Modal: Terima Barang */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl space-y-5">
            <div className="border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900">Catat Penerimaan Barang</h3>
              <p className="text-xs text-slate-500">
                Penerima terikat otomatis dengan identitas login akun aktif (Anti-Pencatutan C5).
              </p>
            </div>

            <form onSubmit={handleSubmitReceipt} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Penerima Barang <span className="text-red-500">*</span>
                  </label>
                  {user?.receiverId ? (
                    <div className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 flex items-center justify-between">
                      <span>👤 {user.name}</span>
                      <span className="text-[11px] font-normal text-slate-500">(Terikat Sesi)</span>
                    </div>
                  ) : (
                    <select
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">-- Pilih Penerima (Udin / Sari / Pemilik) --</option>
                      {receivers?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan</label>
                  <input
                    type="text"
                    value={receiptNote}
                    onChange={(e) => setReceiptNote(e.target.value)}
                    placeholder="Contoh: Pengiriman tahap 1"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-800">Detail Barang Masuk</h4>
                {receiptLines.map((line) => (
                  <div key={line.productId} className="rounded-md border p-3 bg-slate-50 space-y-2">
                    <div className="flex justify-between items-center text-sm font-medium text-slate-900">
                      <span>{line.productName}</span>
                      <span className="text-xs text-slate-500">Satuan: {line.unitOfPurchase}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-blue-800">Diterima (Total Datang)</label>
                        <input
                          type="number"
                          min="0"
                          value={line.goodQty}
                          onChange={(e) => handleLineChange(line.productId, 'goodQty', parseInt(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-red-800">Ditolak (Rusak/Penyok)</label>
                        <input
                          type="number"
                          min="0"
                          value={line.rejectedQty}
                          onChange={(e) => handleLineChange(line.productId, 'rejectedQty', parseInt(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-purple-800">Bonus (Gratis)</label>
                        <input
                          type="number"
                          min="0"
                          value={line.bonusQty}
                          onChange={(e) => handleLineChange(line.productId, 'bonusQty', parseInt(e.target.value) || 0)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    <div className="text-xs bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-600">Estimasi Stok Masuk:</span>{' '}
                      ({line.goodQty} diterima - {line.rejectedQty} ditolak) + {line.bonusQty} bonus ={' '}
                      <span className="font-bold text-emerald-600">
                        {Math.max(0, line.goodQty - line.rejectedQty) + line.bonusQty} {line.unitOfPurchase}
                      </span>
                      {line.rejectedQty > line.goodQty && (
                        <p className="text-red-600 font-semibold mt-1">
                          ⚠️ Jumlah ditolak ({line.rejectedQty}) tidak boleh melebihi jumlah diterima ({line.goodQty})!
                        </p>
                      )}
                    </div>

                    {line.rejectedQty > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-red-700">
                          Alasan Ditolak <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={line.rejectedReason}
                          onChange={(e) => handleLineChange(line.productId, 'rejectedReason', e.target.value)}
                          placeholder="Misal: Kemasan sobek / expired"
                          className={inputClass}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowReceiveModal(false)}
                  className={btnSecondary}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !receiverId}
                  className={btnPrimary}
                >
                  {isSubmitting ? <span data-nosnippet aria-hidden="true">Menyimpan...</span> : 'Simpan Penerimaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelDialog && (
        <ConfirmDialog
          title="Batalkan Pesanan?"
          message="Pesanan ini akan ditutup dan dibatalkan. Sisa barang yang belum dikirim tidak akan diterima lagi. Stok barang yang sudah diterima sebelumnya TIDAK AKAN diubah atau dikurangi."
          confirmLabel="Ya, Batalkan Pesanan"
          busy={cancelling}
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelDialog(false)}
        />
      )}
    </div>
  );
}
