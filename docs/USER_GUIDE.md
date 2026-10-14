# Panduan Pengguna

Panduan ini ditulis untuk Pemilik dan Staf. Sebagian menu tidak akan muncul jika akun tidak memiliki permission terkait.

## 1. Setup dan login

1. Jalankan server dan buka `http://localhost:5173`.
2. Pada database baru, buat Pemilik pertama melalui halaman setup.
3. Tentukan nama tampilan, username unik, dan PIN 4–12 angka. Simpan PIN secara aman; server menyimpan hash-nya.
4. Login memakai username/PIN. Gunakan browser profile yang terpisah bila beberapa orang memakai komputer yang sama secara bersamaan.
5. Gunakan **Keluar** bila selesai memakai sesi.

## 2. Membuat akun pengguna

1. Masuk sebagai Pemilik, buka **Akses & Pengguna**.
2. Isi nama tampilan, username unik, PIN sementara, dan peran awal.
3. Tekan **Buat akun** dan berikan username/PIN kepada pemilik akun melalui saluran yang aman.
4. Pengguna login menggunakan akunnya sendiri. Jangan berbagi akun bersama; identitas operasi mengikuti akun aktif.

PIN sementara tetap menjadi PIN login sampai Pemilik melakukan reset. Aplikasi saat ini tidak menyediakan ubah PIN mandiri.

## 3. Memilih peran dan izin

Peran adalah preset izin. Pemilik dapat memilih antara:

- **Mengikuti preset:** akun memperoleh permission dari perannya.
- **Izin khusus pengguna:** pilih **Atur izin pengguna** pada baris akun, lalu centang fitur yang diperlukan. Izin ini hanya berlaku untuk akun tersebut.
- **Kembali ke preset:** tekan **Gunakan izin preset peran** pada panel izin individual.

Mengganti peran tanpa mengirim daftar permission mengembalikan akun ke preset role yang baru. Mengubah checkbox pada kartu role mengubah preset untuk akun yang masih mengikutinya. Perubahan role/izin mencabut sesi pengguna; pengguna tersebut perlu login kembali.

Terapkan prinsip akses minimum. Jangan memberikan izin penjualan, koreksi stok, pembatalan restock, atau opname kecuali tugas pengguna memang memerlukannya. Harga modal, pengelolaan pengguna/peran, dan pembuatan pesanan restock tetap khusus Pemilik.

## 4. Mengaktifkan dan mengamankan akun

- Hilangkan centang **Aktif** untuk menonaktifkan akun dan mencabut sesi-sesinya.
- Gunakan **Atur ulang PIN** untuk menetapkan PIN baru; sesi lama dicabut.
- Akun Pemilik utama dilindungi dan tidak dapat diubah atau dinonaktifkan dari daftar ini.

## 5. Quick switch khusus Pemilik

Quick switch membantu Pemilik memeriksa pengalaman aplikasi dengan izin seorang pengguna tanpa meminta PIN akun tersebut.

1. Saat login sebagai Pemilik, tekan **Beralih akun**.
2. Pilih akun non-Pemilik yang aktif.
3. Perhatikan banner mode switch. Tindakan bisnis memakai permission serta identitas operasional target, bukan Pemilik.
4. Tekan **Kembali ke Pemilik** untuk mengakhiri mode tersebut.

Hanya Pemilik dapat memulai switch. Saat switch aktif, menu Akses & Pengguna dan izin Pemilik tidak tersedia kecuali target sendiri memiliki izin yang sesuai—dan permission administrasi tetap dilindungi untuk Pemilik. Aktivitas mulai, kembali, logout dalam mode switch, serta forced return ketika target dinonaktifkan dicatat di database.

Keluar ketika berada di mode switch akan mengakhiri sesi Pemilik tersebut. Login Pemilik kembali untuk memulihkan akses; jangan tinggalkan browser dalam keadaan switch aktif.

## 6. Fitur operasional

| Menu | Kegunaan |
|---|---|
| Dashboard | Ringkasan toko, stok aktif, penjualan, dan indikator stok rendah |
| Produk | Melihat/mengelola produk sesuai izin; produk nonaktif tidak boleh digunakan untuk penjualan |
| Penjualan Baru | Mencatat transaksi dari produk yang aktif dan tersedia |
| Riwayat Penjualan | Melihat transaksi yang diizinkan; izin own hanya menampilkan transaksi akun itu |
| Riwayat Stok | Meninjau perubahan stok dan sumber pergerakannya |
| Restock Barang | Melihat pesanan dan mencatat penerimaan jika diizinkan |
| Stok Opname | Melihat riwayat atau membuat/menerapkan opname sesuai permission |
| Akses & Pengguna | Dikelola Pemilik; mengatur akun, PIN, preset, izin individual, dan quick switch |

Identitas penerima dan pemeriksa berasal dari sesi login yang efektif. Data harga modal tidak diberikan kepada akun non-Pemilik.

## Catatan data

Akun, peran, sesi, dan audit quick switch disimpan di PostgreSQL. Data bisnis UI/API masih in-memory dan dibagi di server; data tersebut tidak tahan restart dan tidak terpisah per akun/toko. Baca [Laporan Proyek](PROJECT_REPORT.md#batasan-dan-risiko) sebelum menggunakan aplikasi untuk operasi nyata.
