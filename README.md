# Portal Brighton HUB Cibubur

Portal operasional kantor Brighton HUB Cibubur untuk property advisor dan staf.

Fitur:

- **Beranda (dashboard "Hari ini")**: sapaan dan status kantor, lalu grid kartu: Floor Time hari ini (dari jadwal terbit, shift yang berjalan ditandai), sisa slot Dealing Room hari ini, kantor hari ini (jam buka, chat Operasional, petunjuk arah), pengumuman, dan ulang tahun agen (hari ini & besok). Pemutar **jingle Brighton** mengambang di pojok kanan bawah, langsung memutar saat portal dibuka (atau pada sentuhan pertama bila browser menahan autoplay) dan lanjut bergantian; bisa dijeda dan dipilih lagunya (lagu bawaan di `public/jingles/`). Footer menampilkan tanggal berdiri kantor (6 Mei 2023) dan ucapan setiap 6 Mei.
- **Reservasi** (menu header, halaman terpisah):
  - `#dealing-room` — Dealing Room 1 & 2 per tanggal dan jam.
  - `#floortime` — jadwal Floor Time bulanan yang diterbitkan staf + request pindah/tambah jadwal
    sampai batas waktu (bawaan: Minggu 23:59 WIB pada minggu tayang), serta pendaftaran jaga harian
    (kuota 3 advisor per sesi).
  Pemesan bisa membatalkan reservasinya sendiri dari perangkat yang sama; admin bisa membatalkan semuanya.
- **Business Manager**: BM Brighton HUB Cibubur dengan foto, kode, dan level. Admin bisa menambah (termasuk unggah foto) dan menghapus BM dari portal. Daftar awal ada di `src/data/businessManagers.ts`, foto bawaan di `src/assets/managers/`.
- **Area admin** (link di header setelah login; sidebar di desktop, tab geser di HP) — `#staf-admin` diarahkan ke Statistik portal:
  - *Statistik portal* (`#staf-statistik`): total kunjungan, pengunjung unik, hari ini, 7 hari (dibanding 7 hari sebelumnya), grafik 14 hari. Khusus admin.
  - *Jingle Brighton* (`#staf-jingle`): unggah lagu baru ke Storage bucket `jingles`, dengarkan, hapus.
  - *Ulang tahun agen* (`#staf-ulang-tahun`): data ulang tahun agen — unggah ekspor bulanan .csv/.xlsx (kolom `Code`, `Nama Panggilan`, `Tgl Lahir`), tambah manual, hapus per agen/per bulan. Tahun lahir tidak disimpan.
  - `#staf-floor-time` — **Floor Time Scheduler** (port dari repo `floor-time`): unggah data agen
    (.xlsx/.csv), filter kehadiran, hari libur, request khusus, generate jadwal adil 1x/2x/3x per
    minggu, unduh poster PNG (ZIP), PDF, dan Excel, lalu **terbitkan ke portal** dengan batas request.
    Admin menyetujui/menolak request perubahan dari advisor.
  - `#staf-nota` — **Nota Smart Messenger** (port dari repo `nota-smart-messenger`): hitung BBM +
    biaya jasa per titik, pratinjau nota, unduh PDF/PNG.
- **Kontak staf**: OPERASIONAL, FINANCE, MESSENGER — nama, nomor telepon, dan tombol chat WhatsApp.
- **Jam & lokasi**: jadwal mingguan, alamat, tautan Google Maps, telepon kantor.

Dibangun dengan React 19, Vite, TypeScript, dan Tailwind CSS 4.

## Menjalankan secara lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Perintah          | Fungsi                                   |
| ----------------- | ---------------------------------------- |
| `npm test`        | Unit test (jadwal & reservasi)           |
| `npm run lint`    | Pengecekan tipe TypeScript               |
| `npm run build`   | Build produksi ke folder `dist/`         |
| `npm run preview` | Menjalankan hasil build secara lokal     |

## Database (Supabase)

Portal sudah tersambung ke Supabase project **portal-cibubur** (region Singapura).
URL dan kunci publiknya ada di `.env.development` dan `.env.production`, jadi
`npm run dev` maupun `npm run build` langsung memakai database yang sama.

Skema lengkap ada di [`supabase/schema.sql`](supabase/schema.sql) (sudah terpasang;
aman dijalankan ulang di SQL Editor bila skema diperbarui).

### Menambah admin portal

1. Supabase Dashboard → **Authentication → Users → Add user → Create new user**.
   Isi email & kata sandi, centang *Auto Confirm User*.
2. Dashboard → **SQL Editor**, jalankan (ganti emailnya):
   ```sql
   insert into public.portal_admins (email) values ('nama@domain.com');
   ```
3. Login di portal lewat tombol **Masuk staf**.

Hanya email di tabel `portal_admins` yang bisa mengubah pengumuman, daftar BM,
dan membatalkan reservasi orang lain — akun lain yang sekadar mendaftar tetap ditolak.
Menghapus admin: `delete from public.portal_admins where email = 'nama@domain.com';`

### Mode demo (tanpa database)

Buat `.env.local` berisi `VITE_SUPABASE_URL=""` dan `VITE_SUPABASE_ANON_KEY=""`.
Data lalu disimpan di `localStorage` browser, dan login admin memakai akun demo
`admin@demo.local` / `admin123`.

Aturan yang ditegakkan (di aplikasi dan di database):

- Tanggal lampau dan hari Minggu tidak bisa dipesan; slot yang jamnya sudah lewat ditandai.
- Slot di luar jam buka (mis. 15:00–17:00 pada hari Sabtu) ditandai *Di Luar Jam*.
- Satu slot ruang hanya bisa dipesan sekali per tanggal.
- Floortime maksimal 3 advisor per sesi per tanggal, tanpa nama ganda; Sesi Sore hanya Senin–Jumat.
- Kode pembatalan reservasi tidak pernah dikirim ke pengunjung lain.
- Hanya email di `portal_admins` yang bisa mengubah pengumuman dan daftar Business Manager.

## Struktur

```
src/
  components/          Komponen UI (beranda, Business Manager, staf, jam & lokasi, reservasi, login)
  features/floortime/  Floor Time Scheduler: mesin jadwal, Excel/CSV, poster, terbit & request
  features/nota/       Nota Smart Messenger: rumus & render nota
  assets/fonts/        DejaVu Sans (poster & nota, lisensi di LICENSE-DejaVu.txt)
  data/cibuburData.ts  Data statis: staf, jam operasional, ruang, sesi floortime
  hooks/               useAdmin (sesi admin), useHashRoute (navigasi), useJakartaClock
  services/            Penyimpanan (localStorage / Supabase) dan login admin
  utils/               Logika murni + unit test
public/favicon.svg     Ikon situs
supabase/schema.sql    Tabel, fungsi, kuota, hak akses, dan RLS
```
