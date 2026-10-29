import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/http';
import { createStockAdjustment } from '../api/stock';
import type { Product } from '../types/api';
import { Modal } from './Modal';
import { btnPrimary, btnSecondary, inputClass, labelClass } from './ui';

interface StockAdjustmentModalProps {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}

export function StockAdjustmentModal({ product, onClose, onSaved }: StockAdjustmentModalProps) {
  const [person, setPerson] = useState('');
  const [newQty, setNewQty] = useState(String(product.stock));
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedNewQty = parseInt(newQty, 10);
  const diff = isNaN(parsedNewQty) ? 0 : parsedNewQty - product.stock;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isNaN(parsedNewQty) || parsedNewQty < 0) {
      setError('Stok fisik baru harus berupa bilangan bulat dan tidak boleh negatif (minimal 0).');
      return;
    }
    if (!person.trim()) {
      setError('Nama petugas yang menghitung wajib diisi.');
      return;
    }
    if (!reason.trim()) {
      setError('Alasan penyesuaian stok wajib diisi.');
      return;
    }
    if (diff === 0) {
      setError('Jumlah stok fisik baru sama dengan stok sistem, tidak ada perubahan yang perlu dicatat.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createStockAdjustment({
        productId: product.id,
        oldQty: product.stock,
        newQty: parsedNewQty,
        person: person.trim(),
        reason: reason.trim(),
        note: note.trim() || undefined,
      });
      onSaved();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Penyesuaian Stok (Stock Opname)" onClose={onClose}>
      <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 dark:border-slate-700/80 dark:bg-[#121b2f] dark:text-slate-300">
        <p className="font-bold text-slate-900 dark:text-white">
          {product.name}{' '}
          <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
            ({product.sku})
          </span>
        </p>
        <p className="mt-1">
          Stok di sistem saat ini:{' '}
          <strong className="text-emerald-700 dark:text-emerald-400 font-mono">
            {product.stock} {product.baseUnit}
          </strong>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="adjustment-person">
            Petugas Penghitung <span className="text-red-500">*</span>
          </label>
          <select
            id="adjustment-person"
            className={inputClass}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            required
          >
            <option value="">-- Pilih Petugas / Penanggung Jawab --</option>
            <option value="Udin">Udin</option>
            <option value="Sari">Sari</option>
            <option value="Cak Rofi">Cak Rofi (Pemilik)</option>
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="adjustment-new-qty">
            Hasil Hitung Fisik Sebenarnya ({product.baseUnit}) <span className="text-red-500">*</span>
          </label>
          <input
            id="adjustment-new-qty"
            type="number"
            min={0}
            step={1}
            className={inputClass}
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            required
          />
          {!isNaN(parsedNewQty) && diff !== 0 && (
            <p
              className={`mt-1 text-xs font-semibold ${
                diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              Selisih koreksi: {diff > 0 ? `+${diff}` : diff} {product.baseUnit}{' '}
              ({diff > 0 ? 'Stok bertambah' : 'Stok berkurang'})
            </p>
          )}
        </div>

        <div>
          <label className={labelClass} htmlFor="adjustment-reason">
            Alasan Perbedaan Stok <span className="text-red-500">*</span>
          </label>
          <input
            id="adjustment-reason"
            className={inputClass}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Contoh: Barang rusak, selisih hitung fisik, kadaluarsa"
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="adjustment-note">
            Catatan Tambahan (Opsional)
          </label>
          <textarea
            id="adjustment-note"
            className={inputClass}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Detail kondisi atau informasi tambahan..."
          />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? (
              <span data-nosnippet aria-hidden="true" className="inline-flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan...</span>
              </span>
            ) : (
              'Simpan Penyesuaian'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
