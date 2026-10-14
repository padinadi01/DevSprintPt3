import { useState, type FormEvent } from 'react';
import { getErrorMessage } from '../api/http';
import { createProduct, updateProduct } from '../api/products';
import type { Product } from '../types/api';
import { Modal } from './Modal';
import { btnPrimary, btnSecondary, inputClass, labelClass } from './ui';

interface ProductFormModalProps {
  // null = create a new product, otherwise edit this product.
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

export function ProductFormModal({ product, onClose, onSaved }: ProductFormModalProps) {
  const isEdit = product !== null;
  const [sku, setSku] = useState(product?.sku ?? '');
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? '');
  const [purchasePrice, setPurchasePrice] = useState(product ? String(product.purchasePrice) : '');
  const [sellingPrice, setSellingPrice] = useState(product ? String(product.sellingPrice) : '');
  const [stock, setStock] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const values = {
        sku: sku.trim(),
        name: name.trim(),
        category: category.trim(),
        purchasePrice: Number(purchasePrice),
        sellingPrice: Number(sellingPrice),
      };
      const saved = product
        ? await updateProduct(product.id, values)
        : await createProduct({ ...values, stock: Number(stock) });
      onSaved(saved);
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={isEdit ? 'Ubah Produk' : 'Tambah Produk'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="product-sku">
              SKU
            </label>
            <input
              id="product-sku"
              className={inputClass}
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              required
              maxLength={40}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="product-category">
              Kategori
            </label>
            <input
              id="product-category"
              className={inputClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
              maxLength={60}
            />
          </div>
        </div>

        <div>
          <label className={labelClass} htmlFor="product-name">
            Nama Produk
          </label>
          <input
            id="product-name"
            className={inputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="product-purchase-price">
              Harga Beli (Rp)
            </label>
            <input
              id="product-purchase-price"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="product-selling-price">
              Harga Jual (Rp)
            </label>
            <input
              id="product-selling-price"
              type="number"
              min={1}
              step={1}
              className={inputClass}
              value={sellingPrice}
              onChange={(event) => setSellingPrice(event.target.value)}
              required
            />
          </div>
        </div>

        {isEdit ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
            Stok saat ini: <strong>{product.stock}</strong>. Stok diubah lewat penjualan atau
            penyesuaian stok.
          </p>
        ) : (
          <div>
            <label className={labelClass} htmlFor="product-stock">
              Stok Awal
            </label>
            <input
              id="product-stock"
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={stock}
              onChange={(event) => setStock(event.target.value)}
              required
            />
          </div>
        )}

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
