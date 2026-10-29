import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage, ApiError } from '../api/http';
import { listProducts } from '../api/products';
import { createSale } from '../api/sales';
import { SeoHead } from '../components/SeoHead';
import { useToast } from '../components/ToastProvider';
import { formatNumber, formatRupiah } from '../lib/format';
import { useAsyncData } from '../lib/useAsyncData';
import type { Product, SaleRequestItem } from '../types/api';

const QUICK_CASH_DENOMINATIONS = [10000, 20000, 50000, 100000];

export function NewSalePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load available in-stock products
  const loadProducts = useCallback(() => listProducts({ inStock: true }), []);
  const { data: products, error, loading, reload } = useAsyncData(loadProducts);

  // Local UI & Cart State
  const [cart, setCart] = useState<SaleRequestItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cashReceived, setCashReceived] = useState<number | ''>('');

  // Index products by ID for O(1) lookups
  const productsById = useMemo(
    () => new Map((products ?? []).map((product) => [product.id, product])),
    [products],
  );

  // Compute category list with item counts
  const categories = useMemo(() => {
    if (!products) return [];
    const counts = new Map<string, number>();
    for (const p of products) {
      const cat = p.category?.trim() || 'Lainnya';
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    const list = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [products]);

  // Filter products by category & search query
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const query = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchesCategory =
        selectedCategory === 'ALL' ||
        (p.category?.trim() || 'Lainnya') === selectedCategory;
      const matchesQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query) ||
        (p.category && p.category.toLowerCase().includes(query));
      return matchesCategory && matchesQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Rows with calculated line subtotals
  const cartRows = useMemo(() => {
    return cart.flatMap((line) => {
      const product = productsById.get(line.productId);
      return product
        ? [
            {
              line,
              product,
              subtotal: product.sellingPrice * line.quantity,
            },
          ]
        : [];
    });
  }, [cart, productsById]);

  // Grand total and item quantities
  const totalAmount = cartRows.reduce((sum, row) => sum + row.subtotal, 0);
  const totalItemCount = cartRows.reduce((sum, row) => sum + row.line.quantity, 0);

  // Cash change calculations
  const numericCash = typeof cashReceived === 'number' ? cashReceived : 0;
  const changeAmount = numericCash - totalAmount;
  const isCashExact = typeof cashReceived === 'number' && cashReceived === totalAmount;
  const isCashEnough = typeof cashReceived === 'number' && cashReceived >= totalAmount && totalAmount > 0;
  const isCashDeficit = typeof cashReceived === 'number' && cashReceived > 0 && cashReceived < totalAmount;

  // Keyboard shortcut listener (/ to search, Esc to clear search, F2 to submit)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement !== searchInputRef.current && !(document.activeElement instanceof HTMLInputElement)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchQuery('');
        searchInputRef.current?.blur();
      } else if (e.key === 'F2' && cart.length > 0 && !submitting) {
        e.preventDefault();
        handleSubmit();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart.length, submitting, totalAmount]);

  // 1-Click add to cart
  function handleAddToCart(product: Product) {
    const existing = cart.find((line) => line.productId === product.id);
    const currentQty = existing?.quantity ?? 0;

    if (currentQty >= product.stock) {
      toast.error(`Stok ${product.name} telah mencapai batas maksimal (${product.stock} ${product.baseUnit || 'pcs'}).`);
      return;
    }

    setCart((current) =>
      existing
        ? current.map((line) =>
            line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line,
          )
        : [...current, { productId: product.id, quantity: 1 }],
    );
  }

  // Stepper quantity update
  function handleQuantityChange(productId: string, nextQty: number, maxStock: number) {
    if (nextQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    const clamped = Math.min(Math.max(Math.floor(nextQty), 1), maxStock);
    setCart((current) =>
      current.map((line) => (line.productId === productId ? { ...line, quantity: clamped } : line)),
    );
  }

  // Remove single item
  function handleRemoveItem(productId: string) {
    setCart((current) => current.filter((line) => line.productId !== productId));
  }

  // Clear entire cart
  function handleClearCart() {
    if (cart.length === 0) return;
    setCart([]);
    setCashReceived('');
  }

  // Set exact cash payment
  function handleExactCash() {
    setCashReceived(totalAmount);
  }

  // Quick cash note addition
  function handleAddCash(amount: number) {
    const current = typeof cashReceived === 'number' ? cashReceived : 0;
    setCashReceived(current + amount);
  }

  // Submit sale transaction
  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error('Keranjang belanja masih kosong.');
      return;
    }

    setSubmitting(true);
    try {
      const sale = await createSale(cart);
      toast.success(`Transaksi ${sale.invoiceNumber} berhasil disimpan!`);
      navigate(`/riwayat-penjualan/${sale.id}`);
    } catch (caught) {
      toast.error(getErrorMessage(caught));
      if (caught instanceof ApiError && caught.status === 409) {
        reload();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="-m-4 md:-m-8 min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <SeoHead
        title="Kasir Penjualan 24 Jam"
        description="Sistem POS kasir penjualan express Warung Madura dengan tema gelap modern dan responsif."
        noindex={true}
      />

      {/* POS Top Bar Header */}
      <header className="border-b border-slate-800/90 bg-[#0c1220]/95 backdrop-blur-md px-4 py-3.5 sm:px-6 lg:px-8 sticky top-0 z-20 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center shrink-0">
              <img
                src="/market-icon.webp"
                alt="Warung Madura"
                className="h-full w-full object-cover rounded-[10px]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
                  KASIR PENJUALAN EXPRESS
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Shift 24 Jam
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Pilih atau cari produk, sesuaikan jumlah, lalu selesaikan pembayaran tunai.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={reload}
              title="Perbarui stok dari server"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition-all"
            >
              <span className="text-sm">🔄</span>
              <span>Sync Stok</span>
            </button>
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400">
              <span>Shortcut:</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">/</kbd>
              <span>Cari</span>
              <span className="text-slate-600">·</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-bold">F2</kbd>
              <span>Bayar</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main POS Layout Body */}
      <div className="flex-1 p-3 sm:p-5 lg:p-6">
        {loading && !products && (
          <div
            data-nosnippet
            aria-hidden="true"
            className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-slate-400"
          >
            <div className="h-10 w-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Memuat katalog produk & stok aktif...</p>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto my-12 p-6 rounded-2xl border border-red-500/40 bg-red-950/40 text-center space-y-4">
            <span className="text-4xl">⚠️</span>
            <h3 className="text-lg font-bold text-red-200">Gagal Memuat Katalog Produk</h3>
            <p className="text-sm text-red-300/90">{error}</p>
            <button
              type="button"
              onClick={reload}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg transition-all"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {products && products.length === 0 && (
          <div className="max-w-xl mx-auto my-16 p-8 rounded-2xl border border-slate-800 bg-[#0c1220] text-center space-y-3">
            <span className="text-4xl">📦</span>
            <h3 className="text-lg font-bold text-white">Tidak Ada Stok Produk yang Tersedia</h3>
            <p className="text-xs text-slate-400">
              Semua produk saat ini kosong atau dinonaktifkan. Silakan isi stok terlebih dahulu di menu Inventaris atau Penerimaan Barang.
            </p>
          </div>
        )}

        {products && products.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT COLUMN: Product Catalog & Search (7 Cols on LG, 8 Cols on XL) */}
            <section className="lg:col-span-7 xl:col-span-8 space-y-4">
              {/* Search Bar & Category Filter Bar */}
              <div className="rounded-2xl border border-slate-800/90 bg-[#0d1424] p-4 shadow-xl space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-base">
                    🔍
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama produk, SKU, atau kategori... (Tekan '/' untuk fokus)"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141d33] border border-slate-700/80 text-white placeholder-slate-400 text-sm font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-white transition-colors"
                      title="Hapus pencarian"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Pills Slider */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all border ${
                      selectedCategory === 'ALL'
                        ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-[#141d33] border-slate-700/70 text-slate-300 hover:bg-[#1a2642] hover:text-white'
                    }`}
                  >
                    Semua ({products.length})
                  </button>
                  {categories.map((cat) => {
                    const isSelected = selectedCategory === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all border ${
                          isSelected
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                            : 'bg-[#141d33] border-slate-700/70 text-slate-300 hover:bg-[#1a2642] hover:text-white'
                        }`}
                      >
                        {cat.name} ({cat.count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Products Grid */}
              {filteredProducts.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-[#0d1424] p-12 text-center space-y-2">
                  <span className="text-3xl">🔎</span>
                  <p className="text-sm font-bold text-white">Tidak ada produk yang cocok</p>
                  <p className="text-xs text-slate-400">
                    Coba gunakan kata kunci pencarian yang berbeda atau pilih kategori "Semua".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('ALL');
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                  >
                    Reset Filter
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {filteredProducts.map((product) => {
                    const cartItem = cart.find((i) => i.productId === product.id);
                    const qtyInCart = cartItem?.quantity ?? 0;
                    const isMaxInCart = qtyInCart >= product.stock;
                    const isLowStock = product.stock <= 5;

                    return (
                      <div
                        key={product.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleAddToCart(product)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleAddToCart(product);
                          }
                        }}
                        className={`group relative flex flex-col justify-between p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-150 select-none shadow-md ${
                          qtyInCart > 0
                            ? 'bg-[#101c33] border-emerald-500/80 ring-1 ring-emerald-500/30'
                            : 'bg-[#0d1424] border-slate-800/90 hover:border-emerald-500/50 hover:bg-[#121c33]'
                        } ${isMaxInCart ? 'opacity-80' : 'active:scale-[0.98]'}`}
                      >
                        {/* Top Badges */}
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/60 truncate max-w-[90px]">
                              {product.sku}
                            </span>
                            {qtyInCart > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black shrink-0 shadow-xs">
                                ✓ {qtyInCart} di keranjang
                              </span>
                            )}
                          </div>

                          {/* Product Name */}
                          <h4 className="font-bold text-white text-sm line-clamp-2 group-hover:text-emerald-300 transition-colors leading-snug">
                            {product.name}
                          </h4>

                          {product.category && (
                            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                              {product.category}
                            </p>
                          )}
                        </div>

                        {/* Bottom Price & Stock Info */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-baseline justify-between gap-1">
                          <div>
                            <span className="text-[10px] text-slate-400 block -mb-0.5">Harga</span>
                            <span className="text-emerald-400 font-black text-sm sm:text-base font-mono tracking-tight">
                              {formatRupiah(product.sellingPrice)}
                            </span>
                          </div>

                          <div className="text-right">
                            {isLowStock ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 text-[10px] font-bold">
                                Sisa {product.stock}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] font-medium">
                                Stok {product.stock}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* RIGHT COLUMN: Cart & Payment Drawer (5 Cols on LG, 4 Cols on XL) */}
            <aside className="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-[76px]">
              <div className="rounded-2xl border border-slate-800/90 bg-[#0d1424] p-4 sm:p-5 shadow-2xl flex flex-col space-y-4">
                {/* Cart Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛒</span>
                    <h2 className="font-black text-white text-base">KERANJANG KASIR</h2>
                    {totalItemCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-xs font-black">
                        {totalItemCount} item
                      </span>
                    )}
                  </div>

                  {cart.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCart}
                      className="text-xs font-semibold text-rose-400 hover:text-rose-300 hover:underline transition-colors"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                {cartRows.length === 0 ? (
                  <div className="py-10 px-4 text-center space-y-2 border border-dashed border-slate-800 rounded-xl bg-[#090e1a]">
                    <span className="text-4xl block opacity-40">🛍️</span>
                    <p className="text-sm font-bold text-slate-300">Keranjang Masih Kosong</p>
                    <p className="text-xs text-slate-400">
                      Klik produk pada katalog di sebelah kiri untuk menambahkan item ke transaksi ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {cartRows.map(({ line, product, subtotal }) => (
                      <div
                        key={line.productId}
                        className="rounded-xl border border-slate-800/90 bg-[#121b30] p-3 flex items-center justify-between gap-3 shadow-xs"
                      >
                        {/* Title and Unit Price */}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate leading-tight">
                            {product.name}
                          </p>
                          <p className="text-[11px] font-mono text-emerald-400/90 font-medium mt-0.5">
                            {formatRupiah(product.sellingPrice)} <span className="text-slate-400">/ {product.baseUnit || 'pcs'}</span>
                          </p>
                          <p className="text-[11px] font-mono font-bold text-white mt-1">
                            Subtotal: <span className="text-emerald-300 font-extrabold">{formatRupiah(subtotal)}</span>
                          </p>
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleQuantityChange(line.productId, line.quantity - 1, product.stock)
                            }
                            className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-sm transition-colors active:scale-95"
                            aria-label={`Kurangi ${product.name}`}
                          >
                            -
                          </button>

                          <input
                            type="number"
                            min={1}
                            max={product.stock}
                            step={1}
                            value={line.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                line.productId,
                                Number(e.target.value) || 1,
                                product.stock,
                              )
                            }
                            className="w-11 h-7 rounded-lg bg-[#0a0f1d] border border-slate-700 text-center font-mono font-bold text-xs text-white focus:outline-none focus:border-emerald-500"
                            aria-label={`Jumlah ${product.name}`}
                          />

                          <button
                            type="button"
                            disabled={line.quantity >= product.stock}
                            onClick={() =>
                              handleQuantityChange(line.productId, line.quantity + 1, product.stock)
                            }
                            className="h-7 w-7 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 border border-slate-700 flex items-center justify-center font-bold text-sm transition-colors active:scale-95"
                            aria-label={`Tambah ${product.name}`}
                          >
                            +
                          </button>

                          {/* Delete Item Button */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(line.productId)}
                            className="h-7 w-7 rounded-lg text-rose-400 hover:bg-rose-950/60 hover:text-rose-300 border border-transparent hover:border-rose-800/80 flex items-center justify-center text-xs ml-0.5 transition-colors"
                            title="Hapus dari keranjang"
                            aria-label={`Hapus ${product.name}`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Grand Total Display */}
                <div className="rounded-xl border-2 border-emerald-500/40 bg-[#090e1b] p-4 text-center shadow-inner">
                  <p className="text-[11px] uppercase tracking-widest font-black text-emerald-400/90">
                    TOTAL TAGIHAN PEMBAYARAN
                  </p>
                  <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight mt-1 drop-shadow-sm">
                    {formatRupiah(totalAmount)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {totalItemCount} barang · Harga sudah termasuk PPN (jika ada)
                  </p>
                </div>

                {/* Quick Cash Presets */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="cash-input"
                      className="text-xs font-bold uppercase tracking-wider text-slate-300"
                    >
                      Uang Diterima (Tunai)
                    </label>
                    {totalAmount > 0 && (
                      <button
                        type="button"
                        onClick={handleExactCash}
                        className="text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:underline"
                      >
                        [Uang Pas]
                      </button>
                    )}
                  </div>

                  {/* Cash Buttons Grid */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {QUICK_CASH_DENOMINATIONS.map((nominal) => (
                      <button
                        key={nominal}
                        type="button"
                        onClick={() => setCashReceived(nominal)}
                        className={`py-1.5 px-1 rounded-lg text-xs font-mono font-bold border transition-all ${
                          cashReceived === nominal
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md'
                            : 'bg-[#141d33] border-slate-700/80 text-slate-300 hover:bg-[#1a2745] hover:text-white'
                        }`}
                      >
                        {formatNumber(nominal / 1000)}k
                      </button>
                    ))}
                  </div>

                  {/* Direct Numeric Input with Increments */}
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-mono font-bold text-sm">
                      Rp
                    </span>
                    <input
                      id="cash-input"
                      type="number"
                      min={0}
                      step={500}
                      value={cashReceived}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCashReceived(val === '' ? '' : Number(val));
                      }}
                      placeholder="Nominal uang dari pelanggan..."
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#141d33] border border-slate-700 text-white font-mono font-bold text-base focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
                    />
                    {cashReceived !== '' && (
                      <button
                        type="button"
                        onClick={() => setCashReceived('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Quick increment buttons (+10k, +20k, +50k) */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-slate-400 font-medium">Tambah:</span>
                    <button
                      type="button"
                      onClick={() => handleAddCash(10000)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono"
                    >
                      +10k
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCash(20000)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono"
                    >
                      +20k
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddCash(50000)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-mono"
                    >
                      +50k
                    </button>
                  </div>
                </div>

                {/* Instant Change / Shortage Calculation Box */}
                {totalAmount > 0 && typeof cashReceived === 'number' && cashReceived > 0 && (
                  <div>
                    {isCashEnough ? (
                      <div className="p-3.5 rounded-xl bg-emerald-950/80 border-2 border-emerald-500 text-center space-y-1 shadow-lg shadow-emerald-950/50">
                        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
                          {isCashExact ? '✨ UANG PAS DITERIMA' : '💵 KEMBALIAN PELANGGAN'}
                        </p>
                        <p className="text-2xl font-black text-emerald-300 font-mono tracking-tight">
                          {formatRupiah(changeAmount)}
                        </p>
                      </div>
                    ) : isCashDeficit ? (
                      <div className="p-3 rounded-xl bg-amber-950/80 border-2 border-amber-500/80 text-center space-y-0.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                          ⚠️ UANG MASIH KURANG
                        </p>
                        <p className="text-lg font-black text-amber-300 font-mono">
                          Kurang {formatRupiah(Math.abs(changeAmount))}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Big Primary Submit Button (Checkout CTA) */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={cart.length === 0 || submitting}
                  className="w-full py-3.5 px-4 rounded-xl font-black text-base tracking-wide bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 active:scale-[0.99] text-white shadow-xl shadow-emerald-950/70 border border-emerald-400/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <span data-nosnippet aria-hidden="true" className="inline-flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan Transaksi...</span>
                    </span>
                  ) : (
                    <span>🚀 Selesaikan Transaksi (F2)</span>
                  )}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
