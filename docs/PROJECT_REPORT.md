# Laporan Proyek — Warung Madura Stock Manager

> Dokumen ini merangkum kondisi proyek berdasarkan implementasi repository saat ini. Fitur yang sudah tersedia dibedakan dari batasan yang masih perlu ditangani; dokumen ini bukan klaim kesiapan produksi.

## Daftar Isi

- [Ringkasan eksekutif](#ringkasan-eksekutif)
- [Latar belakang dan tujuan](#latar-belakang-dan-tujuan)
- [Ruang lingkup](#ruang-lingkup)
- [Pemangku kepentingan dan skenario](#pemangku-kepentingan-dan-skenario)
- [Kebutuhan dan pemenuhan](#kebutuhan-dan-pemenuhan)
- [Rancangan dan implementasi](#rancangan-dan-implementasi)
- [Keamanan dan kontrol akses](#keamanan-dan-kontrol-akses)
- [Verifikasi](#verifikasi)
- [Batasan dan risiko](#batasan-dan-risiko)
- [Rekomendasi lanjutan](#rekomendasi-lanjutan)
- [Dokumen terkait](#dokumen-terkait)

## Ringkasan eksekutif

Warung Madura Stock Manager adalah aplikasi web untuk alur dasar pengelolaan produk, penjualan, stok, restock, dan opname. Aplikasi menyediakan antarmuka React dan REST API Express. Autentikasi menggunakan PIN dan sesi, sedangkan otorisasi dilakukan server-side dengan role-based access control (RBAC), preset peran, serta izin khusus per pengguna.

Pemilik dapat membuat akun dan memberi akses terbatas kepada pengguna lain. Fitur quick switch memungkinkan Pemilik melihat aplikasi sebagai pengguna aktif tanpa memasukkan PIN pengguna tujuan. Dalam mode ini sistem menggunakan izin dan identitas operasional akun tujuan, menampilkan penanda mode, dan menyediakan aksi kembali. Peralihan dicatat dalam tabel audit.

**Pemisahan persistensi perlu dipahami:** akun, role, sesi, dan audit autentikasi disimpan melalui Prisma/PostgreSQL. Data operasional yang dilayani endpoint bisnis masih berada di `MockDataStore` dalam memori proses. Karena itu data bisnis tidak tahan restart, tidak sama dengan data hasil seed PostgreSQL, serta belum dipisah per pengguna/toko.

## Latar belakang dan tujuan

Aplikasi ditujukan untuk menggambarkan kebutuhan toko kecil yang membutuhkan pencatatan produk/stok serta pengaturan akses beberapa orang. Sasaran implementasi:

1. Menyediakan alur operasional utama dalam satu UI.
2. Memisahkan identitas login pengguna dan membatasi kemampuan berdasarkan izin.
3. Melindungi PIN, sesi, data harga modal, dan identitas pelaksana.
4. Menyediakan dokumentasi yang menjelaskan instalasi, penggunaan, API, desain, validasi, serta keterbatasan secara dapat ditelusuri.

Repository juga digunakan sebagai sandbox pelatihan. Karena backend bisnis masih menggunakan data mock, jangan menganggap sistem sebagai pencatatan toko produksi.

## Ruang lingkup

### Termasuk

- Setup Pemilik awal dan login/logout memakai username serta PIN.
- Akun pengguna, status aktif, reset PIN, preset role, izin individual.
- Quick switch khusus Pemilik beserta kembali ke sesi Pemilik dan audit trail.
- Produk, penjualan, pemasok, pesanan/penerimaan restock, stok, opname, dan dashboard melalui UI/API.
- Validasi request Zod, middleware autentikasi/RBAC, penyamaran harga modal, dan dokumentasi.

### Tidak termasuk atau belum tersedia

- Persistensi operasional bisnis pada PostgreSQL atau database toko yang tahan restart.
- Pemisahan data tenant/cabang atau isolasi bisnis per akun.
- Infrastruktur produksi seperti deployment pipeline, observability terpusat, backup, kebijakan retensi audit, dan pengelolaan rahasia.
- Mekanisme perubahan PIN mandiri pengguna; reset dikelola Pemilik.

## Pemangku kepentingan dan skenario

| Aktor | Tujuan utama |
|---|---|
| Pemilik | Menyiapkan sistem, mengelola pengguna/peran/izin, mengawasi operasi, dan menguji pengalaman pengguna melalui quick switch |
| Staf/pengguna operasional | Masuk dengan identitas sendiri dan hanya mengakses fungsi yang diberikan |
| Pengembang/pengelola proyek | Menjalankan migrasi, memvalidasi perubahan, dan memahami batas arsitektur |

Skenario yang didukung: Pemilik membuat pengguna, memilih preset role, menyesuaikan izin individual, menonaktifkan akun atau reset PIN; pengguna login dan melakukan tindakan yang diizinkan; Pemilik beralih ke akun aktif untuk memeriksa UI dan otorisasi yang tampak bagi akun tersebut, lalu kembali.

## Kebutuhan dan pemenuhan

| Kebutuhan | Cara pemenuhan |
|---|---|
| Akun tidak saling menimpa | Token sesi acak dan cookie sesi; setiap sesi disimpan terpisah |
| PIN tidak disimpan sebagai teks | Hash scrypt dengan salt |
| Endpoint bisnis mewajibkan autentikasi | Middleware memvalidasi sesi; rute bisnis dilindungi |
| Akses minimal | Default-deny, permission guard server-side, izin granular |
| Akses fleksibel | Pengguna dapat mengikuti preset role atau memiliki izin individual |
| Identitas aktor dapat dipercaya | Middleware memasang user efektif dari sesi; penerimaan/opname mengambil nama dari identitas login efektif |
| Harga modal terbatas | Aksesnya khusus Pemilik dan respons non-Pemilik disaring |
| Quick switch aman secara otorisasi | Hanya sesi Pemilik dapat memulai; izin target menggantikan izin Pemilik selama switch |
| Perubahan akses segera berlaku | Perubahan role/izin mencabut sesi target agar harus login kembali |

Rincian guard dan matriks perizinan: [Audit Guard](../GUARD.md) dan [Matriks Izin](../PERMISSIONS.md).

## Rancangan dan implementasi

- **Frontend:** SPA React/TypeScript, routing halaman, auth context, API client, dan komponen form/layout.
- **Backend:** Express dengan route handlers tipis, schema Zod, layanan, middleware autentikasi/otorisasi, dan error handler.
- **Auth & administrasi:** Prisma menghubungkan PostgreSQL untuk `User`, `AccessRole`, `AuthSession`, dan `AuthSwitchAudit`.
- **Operasi bisnis:** services bisnis mengakses `MockDataStore`; DTO/API konsisten digunakan frontend/backend.
- **Development routing:** Vite pada port 5173 mem-proxy `/api` ke Express pada port 4000.

Rincian alur autentikasi, diagram, model data, dan trade-off desain: [Arsitektur & Model Data](ARCHITECTURE.md).

## Keamanan dan kontrol akses

- PIN diproses menjadi hash scrypt sebelum disimpan.
- Sesi menggunakan token acak; database menyimpan hash token. Cookie memiliki flag `HttpOnly`, `SameSite=Strict`, path API, masa berlaku 8 jam, dan `Secure` ketika `NODE_ENV=production`.
- Endpoint mutasi mensyaratkan header aplikasi `X-App-Request: 1`; request API non-login memerlukan sesi.
- Percobaan login gagal dibatasi pada proses server: 5 kegagalan per alamat/username dalam jendela 15 menit.
- Izin Pemilik yang sensitif—pengelolaan akses, harga modal, dan membuat pesanan yang memerlukan harga modal—tidak dapat diberikan melalui preset/izin pengguna non-Pemilik.
- Quick switch mempertahankan Pemilik sebagai pemulai sesi, tetapi menetapkan pengguna target sebagai identitas efektif. Ia tidak mendapat permission Pemilik selama mode tersebut.
- Tindakan quick switch `START`, `RETURN`, dan `LOGOUT` selama switch dicatat dalam `AuthSwitchAudit`; jika akun target dinonaktifkan saat switch, request berikutnya memaksa sesi kembali ke Pemilik.
- `X-App-Request` bukan pengganti kontrol keamanan deployment; gunakan HTTPS, pembatasan jaringan, secrets management, dan hardening tambahan sebelum produksi.

## Verifikasi

Script tersedia di root `package.json`:

| Pemeriksaan | Perintah | Cakupan |
|---|---|---|
| Type checking | `npm run typecheck` | Server dan client |
| Lint | `npm run lint` | ESLint repository |
| Build | `npm run build` | TypeScript server dan bundle client |
| Tes auth | `npm run test:auth` | Hash PIN, sesi, permission, matriks dasar, redaksi harga |

Pada pekerjaan pengembangan terakhir, type-check, lint terfokus, build, dan tujuh tes auth berhasil. Unit tests tersebut belum menggantikan integrasi menyeluruh; pengujian browser/API untuk setiap alur, beban, migrasi bersih, serta pemulihan database perlu dijalankan sebelum rilis.

## Batasan dan risiko

| Risiko | Dampak | Tindakan yang disarankan |
|---|---|---|
| `MockDataStore` in-memory | Data operasional hilang saat proses restart dan dibagi satu proses | Migrasikan business services ke Prisma/PostgreSQL dan uji transaksi |
| Belum ada isolasi toko | Multi-tenant/cabang tidak aman untuk penggunaan bersama | Tetapkan model tenant dan cakupan data sebelum menambah multi-toko |
| Rate limit login in-memory | Counter hilang saat restart dan tidak berbagi antar instance | Gunakan store terdistribusi serta rate limit di reverse proxy |
| Audit quick switch tanpa kebijakan retensi | Audit dapat tumbuh tanpa batas dan belum tersedia UI audit | Definisikan retensi, akses, ekspor, dan monitoring |
| Reset PIN oleh Pemilik | Belum ada recovery mandiri atau kebijakan rotasi | Definisikan proses recovery dan audit perubahan kredensial |
| Seed PostgreSQL vs mock runtime | Data seed tidak menjadi data yang dilihat UI bisnis | Sinkronkan data layer atau dokumentasikan environment terpisah |
| Test suite kecil dan berfokus auth | Integrasi bisnis dan UI belum sepenuhnya dilindungi regresi | Tambahkan API integration tests, component tests, dan E2E |

## Rekomendasi lanjutan

1. Migrasikan data bisnis dari mock store ke PostgreSQL, termasuk transaksi atomik penjualan/stok dan foreign key pembuat.
2. Tambahkan isolasi tenant/toko/cabang bila dibutuhkan.
3. Tambahkan pengujian integrasi untuk 401/403, izin individual, quick switch, anonimisasi harga modal, serta efek penonaktifan akun.
4. Tambahkan UI audit akses dan kebijakan retensi untuk sesi/quick switch.
5. Siapkan deployment hardening, HTTPS, backup/restore, logging/monitoring, dan manajemen secrets.

## Dokumen terkait

- [README — mulai cepat dan indeks dokumentasi](../README.md)
- [Panduan Pengguna](USER_GUIDE.md)
- [Arsitektur & Model Data](ARCHITECTURE.md)
- [Referensi API](API.md)
- [Panduan Pengembangan](DEVELOPMENT.md)
- [Audit Guard](../GUARD.md)
- [Matriks Izin](../PERMISSIONS.md)
