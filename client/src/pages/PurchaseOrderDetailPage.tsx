import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createGoodsReceipt } from '../api/goods-receipts';
import { cancelPurchaseOrder, getPurchaseOrder } from '../api/purchase-orders';
import { getReceivers } from '../api/receivers';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, LoadingState } from '../components/StateViews';
import { useToast } from '../components/ToastProvider';
import {
  btnPrimary,
  btnSecondary,
  cardClass,
  inputClass,
  labelClass,
  tableHeadClass,
  tdClass,
  thClass,
} from '../components/ui';
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
    if (!po) return;
    const initialLines: ReceiptLineInput[] = (po.items || [])
      .filter((item) => item.remainingQty > 0)
      .map((item) => ({
        productId: item.productId,
        productName: item.productName,
        unitOfPurchase: item.unitOfPurchase,
        goodQty: item.remainingQty,
        bonusQty: 0,
        rejectedQty: 0,
        rejectedReason: '',
      }));

    setReceiptLines(initialLines);
    if (user?.receiverId) {
      setReceiverId(user.receiverId);
    } else if (receivers && receivers.length > 0) {
      setReceiverId(receivers[0].id);
    }
    setShowReceiveModal(true);
  };

  const handleLineChange = (productId: string, field: keyof ReceiptLineInput, value: any) => {
    setReceiptLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, [field]: value } : l)),
    );
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!po) return;
    if (!receiverId) {
      toast.error('Penerima barang wajib dipilih.');
      return;
    }

    const itemsToSubmit = receiptLines
      .filter((l) => l.goodQty > 0 || l.bonusQty > 0 || l.rejectedQty > 0)
      .map((l) => ({
        productId: l.productId,
        goodQty: Number(l.goodQty) || 0,
        bonusQty: Number(l.bonusQty) || 0,
        rejectedQty: Number(l.rejectedQty) || 0,
        rejectedReason: l.rejectedReason.trim() || undefined,
      }));

    if (itemsToSubmit.length === 0) {
      toast.error('Minimal harus ada 1 barang yang diterima atau ditolak.');
      return;
    }

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
      const idempotencyKey = crypto.randomUUID();
      await createGoodsReceipt({
        purchaseOrderId: po.id,
        receiverId,
        idempotencyKey,
        note: receiptNote || undefined,
        items: itemsToSubmit,
      });

      toast.success('Penerimaan fisik berhasil dicatat! Stok produk telah bertambah sesuai rumus.');
      setShowReceiveModal(false);
      reload();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan penerimaan fisik barang.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !po) return <LoadingState />;
  if (error || !po) return <ErrorState message={error || 'Pesanan tidak ditemukan'} onRetry={reload} />;

  const statusBadge = (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold border ${
        po.status === 'COMPLETED'
          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-600/50'
          : po.status === 'PARTIALLY_RECEIVED'
          ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-600/50'
          : po.status === 'CANCELLED'
          ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-600/50'
          : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-600/50'
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
                    className="rounded-xl border border-rose-300 dark:border-rose-900/60 bg-white dark:bg-[#151c2f] px-3.5 py-2 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
                  >
                    Batalkan Pesanan
                  </button>
                )}
                <button type="button" onClick={openModal} className={btnPrimary}>
                  📦 Catat Terima Barang
                </button>
              </>
            )}
          </div>
        }
      />

      {/* PO Summary Card */}
      <div className={`${cardClass} p-5 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <span className="text-sm text-slate-500 dark:text-slate-400">Supplier: </span>
            <span className="font-bold text-slate-900 dark:text-white">{po.supplierName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Status: </span>
            {statusBadge}
          </div>
        </div>
        {po.note && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-700 dark:text-slate-200">Catatan:</span> {po.note}
          </p>
        )}
      </div>

      {/* Items Table: Ordered vs Received vs Remaining */}
      <div className={`${cardClass} overflow-hidden`}>
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#10192d] flex items-center justify-between">
          <h2 className="font-bold text-slate-900 dark:text-white">Daftar Barang Pesanan</h2>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {po.items?.length || 0} produk
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className={tableHeadClass}>
              <tr>
                <th className={thClass}>Produk</th>
                <th className={thClass}>Satuan Kulakan</th>
                <th className={`${thClass} text-right`}>Dipesan</th>
                <th className={`${thClass} text-right`}>Diterima</th>
                <th className={`${thClass} text-right`}>Sisa Belum Kirim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {po.items?.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
                >
                  <td className={tdClass}>
                    <p className="font-bold text-slate-900 dark:text-white">{item.productName}</p>
                    <p className="text-xs font-mono text-slate-400">{item.productSku}</p>
                  </td>
                  <td className={`${tdClass} text-xs font-medium text-slate-600 dark:text-slate-300`}>
                    {item.unitOfPurchase} ({item.unitsPerPurchase} pcs)
                  </td>
                  <td className={`${tdClass} text-right font-mono font-bold`}>{item.orderedQty}</td>
                  <td className={`${tdClass} text-right font-mono font-black text-emerald-600 dark:text-emerald-400`}>
                    {item.receivedQty}
                  </td>
                  <td
                    className={`${tdClass} text-right font-mono font-black ${
                      item.remainingQty > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
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
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#10192d]">
          <h2 className="font-bold text-slate-900 dark:text-white">
            Riwayat Penerimaan Fisik (Goods Receipt)
          </h2>
        </div>
        {po.receipts && po.receipts.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {po.receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="p-4 space-y-2 hover:bg-slate-50 dark:hover:bg-[#121c33] transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {formatDateTime(receipt.receivedAt)}
                    </span>
                    <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      Diterima oleh: <strong className="text-slate-800 dark:text-slate-100">{receipt.receiverName}</strong>
                    </span>
                  </div>
                  {receipt.note && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 italic">
                      "{receipt.note}"
                    </span>
                  )}
                </div>
                <div className="pl-4 border-l-2 border-emerald-500 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                  {receipt.items.map((i) => (
                    <div key={i.id} className="flex gap-4">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{i.productName}:</span>
                      {i.isBonus ? (
                        <span className="text-purple-700 dark:text-purple-400 font-bold">
                          🎁 Bonus: {i.receivedQty} {i.unitOfPurchase}
                        </span>
                      ) : (
                        <span>
                          Masuk: <strong className="text-emerald-700 dark:text-emerald-400 font-mono font-bold">{i.receivedQty - i.rejectedQty}</strong> {i.unitOfPurchase}
                          {i.rejectedQty > 0 && (
                            <span className="text-rose-600 dark:text-rose-400 ml-2 font-semibold">
                              (Ditolak {i.rejectedQty}: {i.rejectedReason})
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Belum ada barang yang diterima untuk pesanan ini.
          </div>
        )}
      </div>

      {/* Modal: Terima Barang */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 p-6 shadow-2xl space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Catat Penerimaan Barang
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Penerima terikat otomatis dengan identitas login akun aktif (Anti-Pencatutan).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>
                    Penerima Barang <span className="text-red-500">*</span>
                  </label>
                  {user?.receiverId ? (
                    <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-[#141d33] px-3.5 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                      <span>👤 {user.name}</span>
                      <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                        (Terikat Sesi)
                      </span>
                    </div>
                  ) : (
                    <select
                      value={receiverId}
                      onChange={(e) => setReceiverId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">-- Pilih Penerima --</option>
                      {receivers?.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Catatan Tambahan</label>
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
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Detail Barang Masuk
                </h4>
                {receiptLines.map((line) => (
                  <div
                    key={line.productId}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50 dark:bg-[#121b2f] space-y-2.5"
                  >
                    <div className="flex justify-between items-center text-sm font-bold text-slate-900 dark:text-white">
                      <span>{line.productName}</span>
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                        Satuan: {line.unitOfPurchase}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          Total Datang
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={line.goodQty}
                          onChange={(e) =>
                            handleLineChange(line.productId, 'goodQty', parseInt(e.target.value, 10) || 0)
                          }
                          className={`${inputClass} text-center font-mono font-bold`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-rose-700 dark:text-rose-300">
                          Ditolak (Rusak)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={line.rejectedQty}
                          onChange={(e) =>
                            handleLineChange(line.productId, 'rejectedQty', parseInt(e.target.value, 10) || 0)
                          }
                          className={`${inputClass} text-center font-mono font-bold`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-700 dark:text-purple-300">
                          Bonus (Gratis)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={line.bonusQty}
                          onChange={(e) =>
                            handleLineChange(line.productId, 'bonusQty', parseInt(e.target.value, 10) || 0)
                          }
                          className={`${inputClass} text-center font-mono font-bold`}
                        />
                      </div>
                    </div>

                    <div className="text-xs bg-white dark:bg-[#0c1220] p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-600 dark:text-slate-400">Estimasi Stok Masuk:</span>{' '}
                      ({line.goodQty} diterima - {line.rejectedQty} ditolak) + {line.bonusQty} bonus ={' '}
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        {Math.max(0, line.goodQty - line.rejectedQty) + line.bonusQty} {line.unitOfPurchase}
                      </span>
                      {line.rejectedQty > line.goodQty && (
                        <p className="text-rose-600 dark:text-rose-400 font-bold mt-1">
                          ⚠️ Jumlah ditolak ({line.rejectedQty}) tidak boleh melebihi jumlah diterima ({line.goodQty})!
                        </p>
                      )}
                    </div>

                    {line.rejectedQty > 0 && (
                      <div>
                        <label className="block text-xs font-bold text-rose-600 dark:text-rose-400 mb-1">
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

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                  disabled={isSubmitting}
                  className={btnPrimary}
                >
                  {isSubmitting ? (
                    <span data-nosnippet aria-hidden="true" className="inline-flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan Penerimaan...</span>
                    </span>
                  ) : (
                    'Simpan Penerimaan Barang'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCancelDialog && (
        <ConfirmDialog
          title="Batalkan Pesanan Pembelian?"
          message={`Apakah Anda yakin ingin membatalkan pesanan ke "${po.supplierName}"? Seluruh sisa barang yang belum dikirim akan ditandai batal.`}
          confirmLabel="Batalkan Pesanan"
          busy={cancelling}
          onConfirm={handleConfirmCancel}
          onCancel={() => setShowCancelDialog(false)}
        />
      )}
    </div>
  );
}
