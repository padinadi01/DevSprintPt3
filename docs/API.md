# Referensi API

Base path API adalah `/api`. Untuk development, gunakan UI di `http://localhost:5173`; Vite mem-proxy `/api` menuju Express `http://localhost:4000`.

## Aturan request

- Request JSON memiliki batas body 1 MB.
- Endpoint bisnis dan administrasi memerlukan sesi cookie `warung_session`.
- Route login/setup memerlukan header `X-App-Request: 1`. Request mutasi API juga mewajibkan header tersebut.
- Body/path/query divalidasi dengan Zod. Tipe input dan detail DTO dapat dilihat pada `server/src/validators/` dan `server/src/types/dto.ts`.
- Permission ditentukan server-side. Menyembunyikan tombol UI bukan pengganti API guard.

Contoh header untuk request browser/API:

```http
Content-Type: application/json
X-App-Request: 1
Cookie: warung_session=<cookie-dari-login>
```

Browser menyimpan dan mengirim cookie `HttpOnly` secara otomatis; jangan mencoba membaca token dari JavaScript.

## Status dan format error

Error menggunakan envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Peran Anda tidak memiliki izin untuk tindakan ini."
  }
}
```

| HTTP | Makna umum |
|---|---|
| `400` | Request tidak valid, header aplikasi tidak ada, atau permission input tidak dikenal |
| `401` | Belum login, kredensial salah, atau sesi berakhir/tidak berlaku |
| `403` | Akun tidak memiliki permission atau endpoint hanya untuk Pemilik |
| `404` | Data/endpoint tidak ditemukan |
| `409` | Konflik aturan bisnis, misalnya username atau operasi tidak kompatibel |
| `429` | Batas percobaan login tercapai |
| `500` | Kesalahan internal; detail diagnostik berada di log server |

## Autentikasi

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/api/health` | Health check publik |
| `GET` | `/api/auth/setup-status` | Mengetahui apakah setup Pemilik diperlukan |
| `POST` | `/api/auth/setup` | Membuat Pemilik pertama dan sesi |
| `POST` | `/api/auth/login` | Login username/PIN; 5 kegagalan per alamat/username dalam 15 menit memicu lockout |
| `GET` | `/api/auth/session` | Mengembalikan identitas efektif dan izin sesi aktif |
| `POST` | `/api/auth/logout` | Menghapus sesi dan cookie; logout saat switch juga dicatat |
| `POST` | `/api/auth/quick-switch/:id` | Memulai switch tanpa PIN target; hanya sesi Pemilik dan target aktif non-Pemilik |
| `POST` | `/api/auth/quick-switch/return` | Kembali dari mode switch ke sesi Pemilik |

Payload utama:

```json
{ "username": "pemilik", "displayName": "Nama Pemilik", "pin": "123456" }
```

Setup menerima username, nama tampilan, dan PIN; login menerima username dan PIN.
PIN wajib 4–12 angka. Gunakan PIN contoh hanya untuk dokumentasi, bukan akun sebenarnya.

Response session memuat `user` (id, username, display name, status, role, permission efektif, dan indikator `isImpersonating`) serta `expiresAt` untuk login/setup. Token sesi dikirim melalui `Set-Cookie`, bukan response body.

## Akses dan pengguna

Semua endpoint `/api/access/*` dibatasi pada Pemilik oleh permission `users.manage` atau `roles.manage`.

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/api/access/permissions` | Katalog permission yang bisa dikelola |
| `GET` | `/api/access/users` | Daftar akun |
| `POST` | `/api/access/users` | Membuat akun dengan username, nama, PIN, dan `roleId` |
| `PATCH` | `/api/access/users/:id` | Mengubah data/status, role, atau permission individual |
| `PATCH` | `/api/access/users/:id/pin` | Reset PIN; sesi pengguna target dicabut |
| `GET` | `/api/access/roles` | Daftar role preset |
| `POST` | `/api/access/roles` | Membuat preset role |
| `PATCH` | `/api/access/roles/:id` | Mengubah nama/permission preset |
| `DELETE` | `/api/access/roles/:id` | Menghapus role khusus yang tidak dipakai |

Untuk izin individual:

- `{ "permissions": ["products.view", "products.manage"] }` mengatur permission akun tersebut saja.
- `{ "permissions": null }` mengembalikan akun agar mengikuti preset role.
- Mengganti `roleId` tanpa mengirim `permissions` mengaktifkan kembali mode mengikuti preset role.
- Perubahan permission/role mencabut sesi pengguna supaya ia harus login kembali.
- Permission owner-only ditolak pada role/permission non-Pemilik.

## Endpoint bisnis

Semua endpoint berikut perlu autentikasi serta permission terkait. Detail izin per route: [Matriks Izin](../PERMISSIONS.md), pemetaan guard: [Audit Guard](../GUARD.md).

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/dashboard` | Ringkasan operasional |
| `GET` | `/api/products` | Daftar produk; validator mendukung filter pencarian dan ketersediaan |
| `GET` | `/api/products/:id` | Detail produk |
| `POST` | `/api/products` | Membuat produk |
| `PATCH` | `/api/products/:id` | Mengubah produk |
| `PATCH` | `/api/products/:id/status` | Mengubah status aktif |
| `DELETE` | `/api/products/:id` | Menghapus produk jika aturan relasi mengizinkan |
| `GET` | `/api/sales` | Daftar penjualan; hasil dibatasi izin all/own |
| `GET` | `/api/sales/:id` | Detail penjualan; own dibatasi pembuat |
| `POST` | `/api/sales` | Membuat penjualan |
| `GET` | `/api/suppliers` | Daftar supplier |
| `POST` | `/api/suppliers` | Membuat supplier |
| `GET` | `/api/restock-orders` | Daftar pesanan restock |
| `GET` | `/api/restock-orders/:id` | Detail restock |
| `POST` | `/api/restock-orders` | Membuat pesanan restock; hanya Pemilik |
| `PATCH` | `/api/restock-orders/:id/cancel` | Membatalkan pesanan |
| `POST` | `/api/restock-orders/:id/receipts` | Mencatat penerimaan dengan identitas efektif sesi |
| `GET` | `/api/inventory-checks` | Daftar opname |
| `GET` | `/api/inventory-checks/:id` | Detail opname |
| `POST` | `/api/inventory-checks` | Membuat opname dengan identitas efektif sesi |
| `POST` | `/api/stock-adjustments` | Penyesuaian stok |
| `GET` | `/api/stock-movements` | Riwayat pergerakan stok |

## Batasan runtime

API bisnis saat ini memakai `MockDataStore` in-memory. Skema PostgreSQL dan seed bisnis bukan sumber data runtime untuk endpoint bisnis. Karena itu dokumentasi endpoint ini menjelaskan HTTP surface yang tersedia, bukan jaminan persistensi transaksi bisnis.
