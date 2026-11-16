# Portal Brighton HUB Cibubur

Portal informasi operasional Brighton HUB Cibubur: inspirasi pagi, kontak WhatsApp staf,
jam operasional & lokasi kantor, reservasi Dealing Room, dan pendaftaran jadwal floortime.

Dibangun dengan React 19, Vite, TypeScript, dan Tailwind CSS 4.

## Menjalankan secara lokal

Prasyarat: Node.js 20 atau lebih baru.

```bash
npm install
npm run dev        # http://localhost:3000
```

Perintah lain:

| Perintah          | Fungsi                                   |
| ----------------- | ---------------------------------------- |
| `npm test`        | Menjalankan unit test logika & jadwal    |
| `npm run lint`    | Pengecekan tipe TypeScript               |
| `npm run build`   | Build produksi ke folder `dist/`         |
| `npm run preview` | Menjalankan hasil build secara lokal     |

## Penyimpanan reservasi

Reservasi Dealing Room dan floortime disimpan **per tanggal**.

- **Tanpa konfigurasi** — data disimpan di `localStorage` browser masing-masing pengguna.
  Cocok untuk demo dan pengembangan, tetapi tiap pengguna melihat datanya sendiri.
- **Dengan Supabase** — semua advisor melihat jadwal yang sama dan booking ganda dicegah
  oleh database.
  1. Buat project di [supabase.com](https://supabase.com).
  2. Buka **SQL Editor**, jalankan isi file [`supabase/schema.sql`](supabase/schema.sql).
  3. Salin `.env.example` menjadi `.env`, lalu isi `VITE_SUPABASE_URL` dan
     `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
  4. Jalankan ulang `npm run dev`.

Aturan yang ditegakkan aplikasi (dan database bila memakai Supabase):

- Tanggal lampau dan hari Minggu tidak bisa dipesan.
- Slot Dealing Room di luar jam buka (mis. 15:00–17:00 pada hari Sabtu) ditandai *Di Luar Jam*.
- Satu slot ruang hanya bisa dipesan sekali per tanggal.
- Floortime maksimal 3 advisor per sesi per tanggal, tanpa nama ganda; Sesi Sore hanya Senin–Jumat.

## Struktur

```
src/
  components/          Komponen UI (hero, direktori staf, jam & reservasi)
  data/cibuburData.ts  Data statis: staf, jam operasional, ruang, sesi floortime
  services/            Penyimpanan reservasi (localStorage / Supabase)
  utils/               Logika murni + unit test
supabase/schema.sql    Skema tabel, aturan unik, kuota, dan RLS
```
