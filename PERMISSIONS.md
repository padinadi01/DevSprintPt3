# Matriks Izin API (Blok B)

## Ruang lingkup dan asumsi

Matriks ini diterapkan oleh middleware RBAC server-side. Semua endpoint bisnis
mensyaratkan login. Peran menyediakan preset izin, lalu Pemilik dapat
menyesuaikan izin secara terpisah untuk setiap akun. Akun yang belum disesuaikan
mengikuti preset perannya; perubahan izin khusus akun tidak memengaruhi akun
lain. Izin harga modal dan pengelolaan akun/peran tetap eksklusif untuk Pemilik.
Izin yang tidak diberikan ditolak.

Pemilik dapat memulai quick switch tanpa PIN akun tujuan. Sesi tetap terikat
pada Pemilik sebagai pemulai, tetapi otorisasi dan identitas operasional
mengikuti akun tujuan sampai Pemilik menekan **Kembali ke Pemilik**. Pemilik
tidak membawa izin Pemilik ke dalam sesi tersebut; mulai/kembali dicatat pada
tabel audit autentikasi.

| Peran | Tanggung jawab |
|---|---|
| **Pemilik** | Peran utama; dapat mengelola akun/peran, harga, dan semua operasi |
| **Staf** | Preset bawaan terbatas: lihat produk/stok/riwayat dan pesanan restock; catat penerimaan atas identitas sendiri |
| **Peran khusus** | Dibuat Pemilik sebagai preset izin; setiap pengguna dapat mengikuti preset atau mendapat penyesuaian izin individual |

`Publik` hanya berlaku untuk pemeriksaan kesehatan layanan. Matriks ini
mengasumsikan identitas setiap pengguna bisa dibuktikan server melalui sesi
terautentikasi.

## Matriks peran × aksi

| Endpoint / aksi | Pemilik | Staf bawaan | Peran khusus |
|---|---:|---:|---:|
| `GET /api/health` — status layanan | Publik | Publik | Publik |
| `GET /api/dashboard` — ringkasan toko | Ya | Tidak | Hanya jika peran diberi izin |
| `GET /api/products` — daftar produk | Ya¹ | Ya¹ | Hanya jika peran diberi izin¹ |
| `GET /api/products/:id` — detail produk | Ya¹ | Ya¹ | Hanya jika peran diberi izin¹ |
| `POST /api/products` — membuat produk | Ya | Tidak | Tidak (perlu harga modal) |
| `PATCH /api/products/:id` — mengubah produk/harga jual | Ya | Tidak | Hanya jika peran diberi izin |
| `PATCH /api/products/:id/status` — mengubah status produk | Ya | Tidak | Hanya jika peran diberi izin |
| `DELETE /api/products/:id` — menghapus produk | Ya | Tidak | Hanya jika peran diberi izin |
| `GET /api/sales` — daftar transaksi | Semua | Ditolak | Hanya jika diberi izin; semua atau sendiri |
| `GET /api/sales/:id` — detail transaksi | Semua | Ditolak | Hanya jika diberi izin; milik sendiri dibatasi |
| `POST /api/sales` — mencatat penjualan | Ya | Ditolak | Hanya jika peran diberi izin |
| `GET /api/suppliers` — daftar supplier | Ya | Ditolak | Hanya jika peran diberi izin |
| `POST /api/suppliers` — menambah supplier | Ya | Ditolak | Hanya jika peran diberi izin |
| `GET /api/restock-orders` — daftar pesanan restock | Semua¹ | Ya¹ | Hanya jika peran diberi izin¹ |
| `GET /api/restock-orders/:id` — detail pesanan restock | Semua¹ | Ya¹ | Hanya jika peran diberi izin¹ |
| `POST /api/restock-orders` — membuat pesanan restock | Ya | Ditolak | Ditolak untuk peran non-Pemilik |
| `PATCH /api/restock-orders/:id/cancel` — membatalkan pesanan | Ya | Ditolak | Hanya jika peran khusus diberi izin |
| `POST /api/restock-orders/:id/receipts` — mencatat penerimaan | Ya | Ya, atas nama login | Hanya jika peran diberi izin; atas nama login |
| `GET /api/inventory-checks` — daftar riwayat opname | Ya | Ya | Hanya jika peran diberi izin |
| `GET /api/inventory-checks/:id` — detail opname | Ya | Ya | Hanya jika peran diberi izin |
| `POST /api/inventory-checks` — membuat/menerapkan opname | Ya | Ditolak | Hanya jika peran khusus diberi izin |
| `POST /api/stock-adjustments` — menyesuaikan stok | Ya | Ditolak | Hanya jika peran khusus diberi izin |
| `GET /api/stock-movements` — melihat riwayat pergerakan stok | Ya | Ya | Hanya jika peran diberi izin |

¹ Izin untuk membuka data tidak otomatis memberi izin melihat **harga modal**.
Penyaringan field tetap mengikuti aturan data sensitif di bawah.

## Aturan khusus data sensitif

### Nama/identitas pelaksana: hanya atas nama dirinya sendiri

- Setiap pengguna hanya boleh membuat transaksi atau catatan operasional atas
  nama identitas yang sedang login. Server mengambil ID dan nama pelaksana dari
  sesi terverifikasi, bukan mempercayai nama/ID yang dikirim dari browser.
- Pemegang izin `sales.view.own` hanya boleh membaca penjualan yang dibuat
  atas identitasnya sendiri; `sales.view.all` dapat membaca seluruh penjualan.
  Pemilik boleh membaca seluruh penjualan. Staf bawaan boleh membaca
  catatan stok, penerimaan, dan opname dalam cakupan toko, tetapi tidak boleh
  membaca data penjualan.
- Pengguna tidak boleh membuat atau mengubah catatan atas nama pengguna lain.
  Pemilik dapat mengaudit nama pelaksana pada catatan yang tersedia.
- `receivedBy` dan `checkedBy` tidak diterima sebagai input tepercaya dari body;
  API menetapkannya dari pengguna yang sedang login. Penjualan baru menyimpan
  ID pembuat untuk filter transaksi milik sendiri.
- Akun awal Pemilik dibuat sekali melalui setup. Pemilik menambah akun Staf
  menggunakan username unik dan PIN pribadi dari modul Akses & Pengguna.
  Sesi per login punya token acak sendiri sehingga beberapa login/perangkat
  tidak saling menimpa; berbagi browser profile tetap berbagi cookie login.

### Harga modal: hanya pemilik

- Harga modal (`purchasePrice`) hanya boleh dibaca dan diubah oleh pemilik.
  Ini berlaku untuk detail produk, pesanan restock, penerimaan, ekspor, dan
  respons API, bukan hanya untuk menyembunyikan kolom di UI.
- Staf bawaan dan pemegang peran khusus non-Pemilik menerima respons yang
  menyaring harga modal. Staf tetap boleh menjalankan penerimaan tanpa menerima
  nilai harga tersebut.
- Hanya Pemilik boleh menetapkan harga modal ketika membuat/mengubah produk
  atau membuat pesanan restock. Harga jual bukan harga modal; perubahannya
  tetap dibatasi ke izin kelola produk.
- Penyaringan harga modal dilakukan pada respons API, bukan hanya pada UI.
  Izin harga modal tidak tersedia di katalog peran khusus.

## Kritik terhadap matriks dan hal yang perlu dipastikan

1. **Harga modal terlindungi untuk peran non-Pemilik.** Respons API menghapus
    field `purchasePrice` secara rekursif dan katalog peran khusus tidak
    menyediakan izin melihatnya. Test memeriksa penyamaran field bersarang.
2. **Batas “milik sendiri” diterapkan untuk penjualan baru.** Pencipta penjualan
    diambil dari sesi dan filter diberlakukan di service untuk daftar/detail.
    Data penjualan bawaan yang tidak memiliki pencipta tidak ditampilkan sebagai
    penjualan milik Staf.
3. **Nama pelaksana tidak dipercaya dari body.** API mengambil penerima dan
    pemeriksa dari sesi login; field tersebut dihapus dari schema input dan UI.
4. **Hak Staf bawaan mengikuti baseline tugas.** Staf hanya bisa melihat stok/
    riwayat dan mencatat penerimaan; koreksi stok, kelola produk, buat/tutup PO,
    dan harga modal tidak diberikan. Pemilik bisa membuat peran khusus untuk
    memberi akses operasional terpilih ke teman, lalu menugaskan akunnya ke
    peran itu.
5. **Model peran saat ini satu toko.** Tidak ada peran supervisor
   atau batas per cabang karena aplikasi saat ini belum menunjukkan kebutuhan
   tersebut. Jika toko memiliki banyak cabang atau persetujuan berlapis,
   cakupan data dan pemisahan kewenangan perlu ditambahkan.
6. **Business store masih in-memory.** User/role/session memakai PostgreSQL,
    tetapi data produk/transaksi/stok yang dilayani `MockDataStore` tetap
    dibagikan di satu proses dan hilang saat restart. Persistensi dan isolasi per
    toko memerlukan migrasi business service ke database; akun tidak membuat
    salinan data toko terpisah.

## Cek terhadap instruksi Blok B

- Tabel peran × aksi: baseline peran; izin tiap akun dapat disesuaikan dari
  modul akses tanpa mengubah izin akun lain.
- Tanpa AI dulu, lalu kritik: kritik mandiri dicatat di dokumen ini karena
  pengguna meminta asisten mengisi draf sekaligus melanjutkan bagian kritik.
- Aturan khusus nama diri dan harga modal: dicatat terpisah dan diterapkan ke
  matriks.
- Perbandingan implementasi: Pemilik dan Staf menjadi peran bawaan; pengguna
  dapat diberi peran khusus dari modul pengelolaan akses.
- Acuan/jawaban pembanding yang disebut pada instruksi “di akhir” tidak tampak
  pada gambar yang tersedia. Kesesuaian terhadap acuan eksternal tersebut tidak
  dapat diverifikasi dari bahan yang ada; jangan anggap rancangan ini sudah
  disetujui sebagai kebijakan produksi sebelum dibandingkan dengan acuan itu.
