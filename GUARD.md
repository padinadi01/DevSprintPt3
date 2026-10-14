# Pemetaan Guard API (Blok A) — Status Implementasi

Inventaris di bawah merekam kondisi awal saat Blok A dikerjakan. Implementasi
login dan RBAC Blok C kini diterapkan pada source; ringkasan aktualnya ada di
bagian berikut. Kolom “guard saat audit” dan daftar tiga risiko adalah baseline
historis, bukan deskripsi guard yang sekarang aktif.

## Guard yang sekarang diterapkan

- Semua endpoint bisnis mensyaratkan sesi valid di cookie HTTP-only. Tanpa sesi
  API mengembalikan `401`; akses yang tidak diizinkan oleh peran mengembalikan
  `403`. `GET /api/health`, pemeriksaan setup, login, dan setup akun pertama
  dikecualikan sesuai fungsinya.
- PIN di-hash dengan scrypt; username unik dan dinormalisasi huruf kecil. Login
  yang salah memberi pesan generik, dan percobaan per IP/username dibatasi
  sementara. Setiap login membuat token sesi acak sendiri yang disimpan sebagai
  hash di PostgreSQL dan berlaku delapan jam; sesi satu akun dapat aktif di
  perangkat/browser terpisah.
- Izin diperiksa di server pada setiap request; akses yang tidak tercantum
  ditolak. Akun staf awal hanya bisa melihat produk/stok/riwayat, melihat
  pesanan restock, dan mencatat penerimaan. Mutasi berisiko tetap ditolak untuk
  Staf bawaan.
- Identitas penerima barang dan pemeriksa opname diambil dari sesi, bukan dari
  body request. Penjualan baru juga diberi ID pembuat; staf yang memiliki izin
  baca penjualan sendiri tidak dapat membaca transaksi pengguna lain.
- Field `purchasePrice` dibuang secara rekursif dari respons untuk semua peran
  selain Pemilik. Izin melihat harga modal dan mengelola pesanan restock
  bernilai modal tidak dapat diberikan ke peran non-Pemilik.
- Modul **Akses & Pengguna** (Pemilik) membuat/menonaktifkan akun, menetapkan
  PIN dan peran, membuat peran khusus, serta mengatur izin per-peran. Hak
  kelola akun/peran dan izin harga modal dilindungi khusus untuk Pemilik.
- Prasyarat operasional: migrasi `20261014000000_add_rbac_auth` harus berhasil
  diterapkan. Pengguna/peran/sesi tersimpan di PostgreSQL; data operasional
  selain itu masih memakai `MockDataStore` in-memory yang sudah ada dan tidak
  menjadi terpisah atau persisten per pengguna.

### Arti kolom guard

- **Login**: pengguna harus memiliki sesi/identitas terautentikasi.
- **Peran**: batasi tindakan ke peran yang sesuai. Nama dan cakupan peran final
  ditetapkan pada [PERMISSIONS.md](./PERMISSIONS.md) dan bisa dikelola melalui
  modul akses.
- **Validasi**: validasi Zod yang sudah ada atau validasi path yang masih perlu.
- **Batas**: rate limit dan/atau pembatasan ukuran hasil/input yang masih perlu.

## Inventaris endpoint

| Endpoint | Risiko/data atau dampak | Guard saat audit awal | Guard target |
|---|---|---|---|
| `GET /api/health` | Rendah — status ketersediaan layanan | Tanpa login; hanya mengembalikan status | Tetap publik; batasi rate bila diperlukan di perimeter |
| `GET /api/dashboard` | Tinggi — ringkasan stok dan angka penjualan | Tidak ada login/peran; tanpa parameter | Login; peran pemilik/admin untuk ringkasan usaha; batasi frekuensi |
| `GET /api/products` | Menengah — daftar produk, harga modal/jual, dan stok | Zod untuk query pencarian dan filter stok; tanpa login/peran | Login; peran sesuai kebutuhan operasional; batasi/paginasi hasil dan panjang pencarian |
| `GET /api/products/:id` | Menengah — detail produk termasuk harga modal | Zod UUID untuk ID; tanpa login/peran | Login; batasi harga modal ke peran berwenang |
| `POST /api/products` | Tinggi — membuat produk, harga, dan stok awal | Zod body (harga dan stok memiliki batas nilai); tanpa login/peran | Login; peran pengelola produk; batasi percobaan tulis |
| `PATCH /api/products/:id` | Tinggi — mengubah identitas produk dan harga modal/jual | Zod UUID dan body; tanpa login/peran | Login; peran pengelola produk; validasi perubahan harga sesuai aturan bisnis |
| `PATCH /api/products/:id/status` | Tinggi — mengaktifkan/menonaktifkan produk untuk operasional | Zod UUID dan status boolean; tanpa login/peran | Login; peran pengelola produk |
| `DELETE /api/products/:id` | Tinggi — penghapusan data produk | Zod UUID; tanpa login/peran | Login; peran pengelola; perlindungan tindakan destruktif dan audit |
| `GET /api/sales` | Tinggi — riwayat dan nilai transaksi | Tanpa login/peran; tanpa parameter | Login; peran yang berhak melihat laporan; batasi/paginasi hasil |
| `GET /api/sales/:id` | Tinggi — detail transaksi dan nilainya | Zod UUID; tanpa login/peran | Login; peran yang berhak melihat transaksi |
| `POST /api/sales` | Tinggi — mencatat transaksi dan mengurangi stok | Zod body, ID produk UUID, jumlah positif berbatas; tanpa login/peran | Login; peran kasir/pemilik; cegah pengiriman ganda dan batasi percobaan |
| `GET /api/suppliers` | Menengah — daftar supplier dan nomor telepon | Tanpa login/peran; tanpa parameter | Login; peran yang perlu mengelola supplier |
| `POST /api/suppliers` | Menengah — menambah data supplier/nomor telepon | Zod body; panjang nama dan telepon dibatasi; tanpa login/peran | Login; peran pengelola supplier; rate limit |
| `GET /api/restock-orders` | Tinggi — pesanan dan informasi biaya pembelian | Tanpa login/peran; tanpa parameter | Login; peran yang berwenang melihat biaya; batasi/paginasi hasil |
| `GET /api/restock-orders/:id` | Tinggi — detail pesanan dan harga modal | Tidak ada validasi ID di route; tanpa login/peran | Login; peran yang berwenang melihat biaya; validasi UUID |
| `POST /api/restock-orders` | Tinggi — membuat pesanan dan komitmen biaya pembelian | Zod body dan UUID untuk referensi; jumlah item belum dibatasi maksimal; tanpa login/peran | Login; peran pengelola restock; batas jumlah item/nilai dan rate limit |
| `PATCH /api/restock-orders/:id/cancel` | Tinggi — membatalkan pesanan pembelian | Tidak ada validasi ID di route; tanpa login/peran | Login; peran pengelola restock; validasi UUID dan status transisi; audit |
| `POST /api/restock-orders/:id/receipts` | Tinggi — mencatat penerimaan barang, termasuk perubahan stok | Zod body dan UUID item; ID pesanan path tidak divalidasi; jumlah/array tidak memiliki batas maksimal; kunci idempotensi diperiksa di memori; tanpa login/peran | Login; peran penerima/pengelola restock; validasi UUID, batas jumlah/nilai, idempotensi persisten dan audit |
| `GET /api/inventory-checks` | Tinggi — riwayat hasil opname dan selisih stok | Tanpa login/peran; tanpa parameter | Login; peran yang berwenang melihat audit stok; batasi/paginasi hasil |
| `GET /api/inventory-checks/:id` | Tinggi — detail opname dan perubahan stok | Tidak ada validasi ID di route; tanpa login/peran | Login; peran yang berwenang melihat audit stok; validasi UUID |
| `POST /api/inventory-checks` | Tinggi — mencatat opname fisik yang dapat mengubah stok | Zod body dan UUID produk; jumlah item/kuantitas tidak memiliki batas maksimal; tanpa login/peran | Login; peran pengelola stok; batas jumlah item/nilai, kendali duplikasi dan audit |
| `POST /api/stock-adjustments` | Tinggi — menambah/mengurangi stok secara langsung | Zod body, UUID produk, jenis dan kuantitas positif berbatas; tanpa login/peran | Login; peran pengelola stok; alasan wajib untuk audit dan rate limit |
| `GET /api/stock-movements` | Menengah — riwayat pergerakan dan penyesuaian stok | Zod query untuk UUID produk; tanpa login/peran | Login; peran yang berwenang melihat audit stok; batasi/paginasi hasil |

## Tiga aksi paling berbahaya pada audit awal

1. **`POST /api/sales` — transaksi dan pengurangan stok.** Kini butuh login dan
   izin `sales.create`; pencipta dicatat untuk transaksi baru. Penyimpanan data
   penjualan tetap in-memory, mengikuti batasan MockDataStore.
2. **`POST /api/restock-orders/:id/receipts` — penerimaan barang dan perubahan
   stok.** Kini butuh login dan izin `restock.receive`; nama penerima diambil
   dari sesi. Kunci idempotensi dan data operasional masih berada di memori.
3. **`POST /api/stock-adjustments` dan `POST /api/inventory-checks` — perubahan
   stok/audit opname.** Keduanya kini memerlukan izin khusus; peran Staf bawaan
   ditolak. Identitas pemeriksa opname diambil dari sesi. Kegiatan stok belum
   dipersistenkan oleh lapisan business-store saat ini.

Selain tiga aksi di atas, perubahan harga/status dan penghapusan produk,
pembatalan restock, serta pembacaan harga modal/riwayat penjualan juga
dilindungi oleh izin server-side; harga modal hanya dapat dilihat Pemilik.
