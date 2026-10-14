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
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await createStockAdjustment({
        productId: product.id,
        type,
        quantity: Number(quantity),
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
    <Modal title="Penyesuaian Stok" onClose={onClose}>
      <p className="mb-4 text-sm text-slate-600">
        {product.name} <span className="text-slate-400">({product.sku})</span>. Stok saat ini:{' '}
        <strong>{product.stock}</strong>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset>
          <legend className={labelClass}>Jenis</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="adjustment-type"
                checked={type === 'IN'}
                onChange={() => setType('IN')}
              />
              Barang masuk
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="adjustment-type"
                checked={type === 'OUT'}
                onChange={() => setType('OUT')}
              />
              Barang keluar
            </label>
          </div>
        </fieldset>

        <div>
          <label className={labelClass} htmlFor="adjustment-quantity">
            Jumlah
          </label>
          <input
            id="adjustment-quantity"
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="adjustment-note">
            Catatan (opsional)
          </label>
          <input
            id="adjustment-note"
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Contoh: Barang rusak, Stock opname, Barang masuk manual"
            maxLength={200}
          />
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Batal
          </button>
          <button type="submit" className={btnPrimary} disabled={submitting}>
            {submitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
