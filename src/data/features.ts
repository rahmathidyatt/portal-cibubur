/**
 * Saklar fitur portal. Ubah ke `true` untuk menampilkan kembali fitur yang
 * sedang disembunyikan (kode & data tetap ada).
 */
export const FEATURES = {
  /** Reservasi Dealing Room (menu, halaman #dealing-room, kartu beranda). */
  dealingRoom: false,
  /** Pendaftaran jaga harian Floortime (jadwal kini ditentukan kantor lewat Floor Time Scheduler). */
  floortimeRegistration: false
} as const;
