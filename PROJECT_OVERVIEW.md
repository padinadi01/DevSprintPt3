# 📦 Warung Madura Stock Manager & DevSprint Container Lab
## System Overview, Architecture, and AI Context Specification

> **Catatan untuk AI / Model Lain (AI Prompt & Context):**
> Dokumen ini adalah spesifikasi teknis dan rangkuman arsitektur lengkap aplikasi **Warung Madura Stock Manager**. Gunakan dokumen ini sebagai acuan konteks utama mengenai struktur kode, alur bisnis, endpoint REST API, sistem RBAC (Role-Based Access Control), database schema isolation, mekanisme ketahanan (*failover resilience*), dan cara menjalankan unit testing.

---

## 1. Ringkasan Eksekutif & Tautan Live

* **Tujuan Proyek:** Sistem manajemen stok, inventaris kasir, pengadaan barang (*procurement*), dan penerimaan barang (*goods receipt*) untuk toko ritel "Warung Madura", yang diintegrasikan ke dalam arsitektur multi-tenant container lab pada Google Cloud Platform (GCP).
* **Live Production URL (Cloud Run):** [https://student1-131481044262.asia-southeast1.run.app/](https://student1-131481044262.asia-southeast1.run.app/)
* **Interactive Lab Dashboard:** [https://student1-131481044262.asia-southeast1.run.app/lab](https://student1-131481044262.asia-southeast1.run.app/lab)
* **GitHub Repository:** `https://github.com/padinadi01/DevSprintPt3.git`
* **Branch Mahasiswa:** `student1`
* **Target PostgreSQL Schema:** `student1`

---

## 2. Kredensial Pengujian (Test Accounts)

Aplikasi dilengkapi sistem autentikasi berbasis PIN dengan enkripsi `bcrypt` dan proteksi *brute-force rate limiting*:

| Role | Username | PIN | Hak Akses Utama |
| :--- | :--- | :--- | :--- |
| **PEMILIK** *(Owner / Cak Rofi)* | `pemilik` | `1234` | **Master Control Penuh** (`ALL`), Manajemen Pengguna, Pengaturan Akses & Izin Staf, Dashboard Keuangan, Laporan, Pembatalan Penerimaan Barang. |
| **STAF** *(Udin)* | `udin` | `1111` | Lihat Stok, Penerimaan Barang Masuk, Kasir/Penjualan. |
| **STAF** *(Sari)* | `sari` | `2222` | Lihat Stok, Penerimaan Barang Masuk, Kasir/Penjualan. |

---

## 3. Tech Stack & Arsitektur Sistem

```
                                  [ Klien / Browser ]
                                           │
                                           ▼
             [ Google Cloud Run (Container Service: app-student1) ]
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
          [ Frontend SPA (React) ]                   [ Backend API (Express.js) ]
          • Vite + Tailwind CSS                      • Node.js 20 (Alpine Linux)
          • Compiled to /public                      • TypeScript precompiled to /dist
          • Embedded in Docker                       • REST Router di server.js
                     │                                           │
                     └─────────────────────┬─────────────────────┘
                                           ▼
                        [ Resilient Database Access Layer ]
                        • Primary: Prisma ORM -> PostgreSQL (Supabase)
                          Schema: "student1" (Multi-tenant search_path)
                        • Failover Fallback: In-Memory Mock Store
                          (Auto-aktivasi saat DB standby/unreachable atau CI)
```

### Komponen Inti:
1. **Frontend:** Single Page Application (SPA) berbasis React 18, Tailwind CSS, Lucide Icons, dan Vite. Terkompilasi di direktori `/public`.
2. **Backend Entrypoint (`server.js`):**
   - Melayani endpoint bawaan DevSprint lab: `/api/health`, `/api/schema-info`, `/api/notes`, dan visual dashboard `/lab`.
   - Melayani seluruh modul bisnis Warung Madura di bawah prefix `/api/*`.
   - Melayani routing SPA (SPA fallback ke `public/index.html`).
3. **Database & Schema Isolation:**
   - Multi-tenant PostgreSQL terbagi per-mahasiswa melalui skema terisolasi (`student1`).
   - Search path di-enforce otomatis: `SET search_path TO "student1", public;`.
4. **Resilience & Zero-500 Fallback Architecture (`src/lib/db.ts` & `src/lib/memory-db.ts`):**
   - Menghadapi kondisi Supabase gratis yang sering masuk ke status *paused/inactive*, sistem memiliki transparent proxy adapter.
   - Jika koneksi Prisma ke remote database mengalami `P1001` (Can't reach database server), `ENOTFOUND`, atau ketiadaan variabel `.env` di lingkungan CI, sistem **tidak pernah melempar error 500 crash**, melainkan secara mulus (*transparent failover*) mengalihkan operasi baca-tulis ke *in-memory repository* yang telah di-preload dengan master data lengkap (14 produk, user, supplier, dan PO).

---

## 4. Perbaikan Logika Bisnis: Fitur Penerimaan Barang (Goods Receipt)

### Gejala Masalah Lama:
Sebelumnya terjadi anomali di mutasi stok pada produk seperti "Minyak Goreng 1L" (SMB-001):
Barang datang 2 pcs dengan bonus 1 pcs dan **2 pcs ditolak**. Namun stok bertambah **+3**, karena barang yang ditolak tidak dikurangkan dari stok masuk.

### Rumus & Aturan Bisnis Baru (Fixed):
$$\mathbf{stok\_masuk} = \mathbf{qty\_diterima} - \mathbf{qty\_ditolak} + \mathbf{qty\_bonus}$$

1. **Definisi Nilai:**
   - `qty_diterima`: Jumlah fisik kotor (*gross*) yang dikirim/datang dari supplier.
   - `qty_ditolak`: Jumlah barang yang rusak/cacat/kadaluarsa dan dikembalikan ke supplier.
   - `qty_bonus`: Barang ekstra cuma-cuma dari supplier (dicatat dengan harga pokok Rp 0).
2. **Validasi Bisnis:**
   - `qty_ditolak` **tidak boleh lebih besar** dari `qty_diterima`.
   - `qty_diterima`, `qty_ditolak`, dan `qty_bonus` tidak boleh bernilai negatif ($< 0$).
3. **Konsistensi Audit Trail (`StockMovement`):**
   - `beforeStock`, `afterStock`, dan kolom `quantity` berasal dari satu sumber nilai tunggal (`stok_masuk`).
   - Format catatan (*note*) otomatis distandarisasi:
     `"Penerimaan barang: diterima X pcs, ditolak Y pcs, bonus Z pcs -> masuk W pcs"`

---

## 5. Ringkasan Unit Test Otomatis

File pengujian unit terletak di [`scripts/test-goods-receipt-logic.ts`](file:///C:/Users/terse/Downloads/DevSprintPt3/scripts/test-goods-receipt-logic.ts). Seluruh skenario telah teruji **100% Lulus (PASS)**:

| Kasus Uji | Diterima | Ditolak | Bonus | Hasil Stok Masuk | Status |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Kasus 1** | 2 | 0 | 0 | **+2 pcs** | ✅ PASS |
| **Kasus 2** | 2 | 2 | 1 | **+1 pcs** | ✅ PASS |
| **Kasus 3** | 4 | 2 | 1 | **+3 pcs** | ✅ PASS |
| **Kasus 4** | 2 | 3 | 0 | **Validasi Error (Ditolak > Diterima)** | ✅ PASS |

Perintah untuk mengeksekusi test suite:
```powershell
npm test
```

---

## 6. Modul Otorisasi & Master Control (RBAC)

Fitur RBAC (*Role-Based Access Control*) dirancang dengan hierarki dua peran:
1. **Role `PEMILIK` (Owner):**
   - Memiliki akses eksklusif ke halaman **Master Control** (`/master-control` atau `/settings/users`).
   - Dapat menambah staf baru (`POST /api/auth/users`).
   - Dapat mengubah peran pengguna (`PATCH /api/auth/users/:id/role`).
   - **Fitur Penambahan Akses ke Staf:** Dapat memberikan izin granular kepada staf (`PATCH /api/auth/users/:id/permissions`), misalnya izin khusus `VIEW_DASHBOARD`, `VIEW_REPORTS`, `STOCK_IN`, atau `SALE`.
2. **Role `STAF` (Staff):**
   - Terbatas hanya pada operasional kasir dan pencatatan barang masuk sesuai daftar `permissions` yang diberikan oleh Pemilik.
   - Tidak dapat mengakses menu Master Control. Percobaan akses langsung menghasilkan `403 FORBIDDEN: Akses ditolak. Fitur ini khusus untuk Pemilik toko.`

---

## 7. Katalog Endpoint REST API Utama

### Autentikasi & RBAC
* `POST /api/auth/login`: Login dengan `{ username, pin }`. Mengembalikan token JWT dan profil pengguna.
* `GET /api/auth/me`: Mengambil info sesi aktif berdasarkan Bearer JWT.
* `GET /api/auth/users`: *(Pemilik saja)* Mendapatkan seluruh daftar user, role, dan izin.
* `POST /api/auth/users`: *(Pemilik saja)* Membuat staf baru.
* `PATCH /api/auth/users/:id/permissions`: *(Pemilik saja)* Mengatur daftar permission staf.
* `PATCH /api/auth/users/:id/role`: *(Pemilik saja)* Mengubah role (`PEMILIK` / `STAF`).

### Produk & Inventaris
* `GET /api/products`: Menampilkan seluruh katalog produk aktif, stok saat ini, dan konversi satuan.
* `POST /api/products`: Menambah master produk baru.
* `GET /api/dashboard`: Mendapatkan metrik ringkasan omzet hari ini, total SKU, unit stok, dan peringatan *low stock*.
* `GET /api/stock/movements`: Riwayat mutasi kartu stok beserta catatan otomatis.

### Pengadaan & Penerimaan Barang (Procurement)
* `GET /api/purchase-orders`: Mengambil daftar Surat Pesanan (PO).
* `POST /api/purchase-orders`: Membuat Surat Pesanan baru ke supplier.
* `GET /api/goods-receipts`: Mengambil daftar histori tanda terima barang.
* `POST /api/goods-receipts`: Mencatat penerimaan barang (menerapkan rumus `stok_masuk` dan validasi penolakan).
* `POST /api/goods-receipts/:id/reverse`: *(Pemilik saja)* Membatalkan penerimaan barang dan mengembalikan stok secara atomik.

### Lab Container Endpoints
* `GET /api/health`: Healthcheck status kontainer dan integrasi Warung Madura (`warungMadura: "online"`).
* `GET /api/schema-info`: Info user PostgreSQL, active schema (`student1`), dan daftar tabel aktif.
* `GET /api/notes`, `POST /api/notes`, `DELETE /api/notes/:id`: Lab CRUD notes terisolasi per skema.

---

## 8. Panduan Menjalankan Proyek Secara Mandiri

### Menjalankan di Lingkungan Lokal:
```powershell
# 1. Pindah ke direktori proyek
cd C:\Users\terse\Downloads\DevSprintPt3

# 2. Install dependensi
npm install

# 3. Jalankan suite unit test
npm test

# 4. Compile TypeScript server
npm run build:server

# 5. Jalankan aplikasi
npm start
```
Aplikasi lokal akan berjalan pada `http://localhost:8080`.

### Alur Deployment CI/CD (GitHub & Cloud Run):
1. **GitHub Actions:** Setiap `git push origin student1` secara otomatis memicu `.github/workflows/ci.yml` yang memvalidasi sintaks `node --check server.js`, menjalankan `npm test`, dan menguji build Docker image.
2. **GCP Cloud Build:** Webhook GitHub secara otomatis mem-build Dockerfile dan merilis revisi kontainer terbaru ke layanan Cloud Run `app-student1`.

---

## 9. Struktur Direktori Proyek

```
DevSprintPt3/
├── .github/workflows/
│   └── ci.yml                 # Pipeline CI GitHub Actions
├── client/                    # Source code frontend (React SPA)
├── dist/                      # Hasil kompilasi backend TypeScript
├── prisma/
│   ├── schema.prisma          # Definisi model data PostgreSQL
│   └── seed.ts                # Master seed data inventori & user
├── public/                    # Aset statis & SPA bundle yang disajikan server
├── scripts/
│   └── test-goods-receipt-logic.ts # Automated unit test suite
├── src/                       # Source code backend (TypeScript)
│   ├── controllers/           # HTTP Request Handlers
│   ├── lib/
│   │   ├── db.ts              # Resilient Prisma Client & Transparent Proxy
│   │   └── memory-db.ts       # Failover In-Memory Store
│   ├── middleware/            # Auth & RBAC Middleware
│   ├── routes/                # Express Route Handlers
│   ├── services/              # Business Logic Services
│   └── validators/            # Zod Input Validation Schemas
├── Dockerfile                 # Multi-stage container recipe
├── package.json               # Dependensi & NPM scripts
├── server.js                  # Express Entrypoint & Static Server
└── PROJECT_OVERVIEW.md        # Dokumen ini
```
