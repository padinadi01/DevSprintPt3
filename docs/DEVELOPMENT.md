# Panduan Pengembangan

## Prasyarat

- Node.js `20.19` atau lebih baru dan npm.
- PostgreSQL `15` atau lebih baru.
- Port development yang tersedia: UI `5173`, API `4000` (dapat disesuaikan).

## Setup lokal

1. Buat database `warung_madura` di PostgreSQL.
2. Buat `server/.env` (jangan commit file ini):

   ```env
   DATABASE_URL="postgresql://postgres:<PASSWORD_URL_ENCODED>@localhost:5432/warung_madura?schema=public"
   PORT=4000
   ```

   Gunakan nama user/password/database lokal yang benar. Encode karakter khusus password sebagai komponen URL. Jangan tempelkan secret ke issue, dokumentasi, atau chat.
3. Jalankan dari root proyek:

   ```bash
   npm install
   npm run db:generate
   npm run db:migrate
   npm run dev
   ```

4. Buka UI `http://localhost:5173`; health check API tersedia di `http://localhost:4000/api/health`.
5. Pada database baru, buat akun Pemilik lewat UI.

Vite development server mem-proxy request `/api` ke port 4000. Pengaturan proxy berada di `client/vite.config.ts`.

## Database dan migrasi

| Perintah | Dampak |
|---|---|
| `npm run db:generate` | Generate Prisma Client dari schema |
| `npm run db:migrate` | Terapkan migrasi committed (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | Workflow membuat/menerapkan migrasi saat pengembangan schema |
| `npm run db:seed` | Jalankan seed PostgreSQL untuk model bisnis |
| `npm run db:reset` | Reset database, migrasikan, lalu seed ulang; destruktif terhadap database lokal |

Seed mengisi data model bisnis PostgreSQL. Endpoint bisnis saat ini memakai `MockDataStore`, sehingga hasil seed tidak otomatis menjadi data yang terlihat pada UI operasional. Jangan gunakan `db:reset` pada database berisi data yang ingin dipertahankan.

## Skrip root

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Frontend dan API dalam mode development |
| `npm run build` | Build server dan client |
| `npm run lint` | ESLint seluruh workspace |
| `npm run typecheck` | TypeScript server dan client |
| `npm run test:auth` | Unit tests auth/RBAC |

Client juga memiliki `npm run preview` pada workspace client. Server production hasil build dapat dijalankan dengan `npm run start -w server`, setelah konfigurasi database/runtime tersedia.

## Alur perubahan schema

1. Edit `server/prisma/schema.prisma`.
2. Buat migrasi di lingkungan development dengan `npm run db:migrate:dev`.
3. Periksa SQL migrasi dan schema sebelum diterapkan.
4. Commit schema dan migration bersama.
5. Generate client lalu validasi typecheck, tests, build.
6. Deploy memakai `npm run db:migrate`.

Jangan mengedit migration lama yang sudah diterapkan di database bersama; buat migrasi baru.

## Verifikasi sebelum perubahan dianggap selesai

```bash
npm run lint
npm run typecheck
npm run test:auth
npm run build
```

Untuk perubahan API/DB, tambahkan pengujian integrasi yang menguji request dan response aktual. Tes `test:auth` yang ada adalah unit test terfokus; belum mencakup seluruh alur browser atau operasi bisnis terhadap PostgreSQL.

## Troubleshooting

| Gejala | Langkah pemeriksaan |
|---|---|
| Prisma `P1000` | Username/password pada `server/.env` tidak diterima PostgreSQL; periksa kredensial lokal dan URL-encoding |
| Prisma `P1001` | Pastikan layanan PostgreSQL hidup, host/port benar, dan firewall lokal tidak memblokir |
| `P1003` / database tidak ditemukan | Buat `warung_madura` atau perbaiki nama DB pada `DATABASE_URL` |
| Prisma Client belum diinisialisasi | Jalankan `npm run db:generate` |
| Migrasi tidak cocok | Periksa daftar migration/status serta koneksi database; jangan reset database produksi |
| API health gagal | Pastikan port API yang dikonfigurasi tersedia dan cek output server |
| UI tak dapat menghubungi API | Pastikan Vite proxy dan server berjalan pada port yang diharapkan |
| Port `4000`/`5173` terpakai | Sesuaikan `PORT` API dan `server.port`/proxy Vite |
| Data bisnis hilang setelah restart | Perilaku saat ini: layanan bisnis memakai store in-memory |

## Referensi repository

- [Root package scripts](../package.json)
- [Server package scripts](../server/package.json)
- [Client package scripts](../client/package.json)
- [Prisma schema](../server/prisma/schema.prisma)
- [Vite config](../client/vite.config.ts)
- [Laporan dan risiko proyek](PROJECT_REPORT.md)
