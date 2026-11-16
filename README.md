# Portal Brighton HUB Cibubur

Portal operasional kantor Brighton HUB Cibubur untuk property advisor dan staf.

Fitur:

- **Hari ini**: sapaan, status kantor buka/tutup (WIB), agenda Dealing Room dan floortime hari ini, pengumuman, inspirasi pagi.
- **Reservasi**: Dealing Room 1 & 2 per tanggal dan jam, pendaftaran floortime (kuota 3 advisor per sesi). Pemesan bisa membatalkan reservasinya sendiri dari perangkat yang sama; admin bisa membatalkan semuanya.
- **Kontak staf**: chat WhatsApp dengan pesan terisi otomatis, status staf yang diperbarui admin.
- **Kalkulator**: cicilan KPR, BPHTB & PPh final, pembagian komisi (perkiraan).
- **Dokumen & formulir**: tautan SOP, template, dan formulir yang dikelola admin.
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
| `npm test`        | Unit test (jadwal, reservasi, kalkulator)|
| `npm run lint`    | Pengecekan tipe TypeScript               |
| `npm run build`   | Build produksi ke folder `dist/`         |
| `npm run preview` | Menjalankan hasil build secara lokal     |

## Mode data

**Tanpa konfigurasi (mode demo)** — semua data (reservasi, pengumuman, dokumen, status staf)
disimpan di `localStorage` browser masing-masing. Login admin memakai akun demo
`admin@demo.local` / `admin123`, yang hanya berlaku di mode ini.

**Dengan Supabase (mode produksi)** — semua pengguna melihat data yang sama:

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan seluruh isi [`supabase/schema.sql`](supabase/schema.sql).
   File ini aman dijalankan ulang setiap kali skema diperbarui.
3. Buka **Authentication → Users → Add user** dan buat akun untuk tiap admin/staf.
   Lalu di **Authentication → Sign In / Providers**, matikan *Allow new users to sign up*
   agar orang lain tidak bisa mendaftar sendiri sebagai admin.
4. Salin `.env.example` menjadi `.env`, isi `VITE_SUPABASE_URL` dan
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
5. Jalankan ulang `npm run dev`. Akun demo otomatis tidak berlaku lagi.

Aturan yang ditegakkan (di aplikasi dan di database):

- Tanggal lampau dan hari Minggu tidak bisa dipesan; slot yang jamnya sudah lewat ditandai.
- Slot di luar jam buka (mis. 15:00–17:00 pada hari Sabtu) ditandai *Di Luar Jam*.
- Satu slot ruang hanya bisa dipesan sekali per tanggal.
- Floortime maksimal 3 advisor per sesi per tanggal, tanpa nama ganda; Sesi Sore hanya Senin–Jumat.
- Kode pembatalan reservasi tidak pernah dikirim ke pengunjung lain.
- Hanya admin yang bisa mengubah status staf, pengumuman, dan dokumen.

## Struktur

```
src/
  components/          Komponen UI (ringkasan hari ini, staf, kalkulator, dokumen, reservasi, login)
  data/cibuburData.ts  Data statis: staf, jam operasional, ruang, sesi floortime
  hooks/               useAdmin (sesi admin), useBookings, useJakartaClock
  services/            Penyimpanan (localStorage / Supabase) dan login admin
  utils/               Logika murni + unit test
public/favicon.svg     Ikon situs
supabase/schema.sql    Tabel, fungsi, kuota, hak akses, dan RLS
```
