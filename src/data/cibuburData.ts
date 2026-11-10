export interface MorningQuote {
  id: string;
  title: string;
  quote: string;
  authorOrContext: string;
  dailyFocus: string;
}

export type StaffDivision = 'Operasional' | 'Keuangan' | 'Kurir & Dokumen';

export type StaffAvailabilityStatus = 'Online' | 'Sibuk' | 'Di Luar Kantor';

export interface StaffStatusLegendItem {
  status: StaffAvailabilityStatus;
  englishLabel: string;
  colorName: string;
  dotClass: string;
  textClass: string;
  meaning: string;
}

export const STAFF_STATUS_LEGEND: StaffStatusLegendItem[] = [
  {
    status: 'Online',
    englishLabel: 'Online',
    colorName: 'Hijau',
    dotClass: 'bg-emerald-600 ring-2 ring-emerald-600/25',
    textClass: 'text-emerald-800',
    meaning: 'Staf berada di meja kantor dan siap merespons langsung.'
  },
  {
    status: 'Sibuk',
    englishLabel: 'Busy',
    colorName: 'Kuning / Amber',
    dotClass: 'bg-amber-600 ring-2 ring-amber-600/25',
    textClass: 'text-amber-800',
    meaning: 'Sedang verifikasi berkas atau melayani tamu (estimasi respons ~10 menit).'
  },
  {
    status: 'Di Luar Kantor',
    englishLabel: 'Out of Office',
    colorName: 'Abu-abu',
    dotClass: 'bg-slate-400 ring-2 ring-slate-400/25',
    textClass: 'text-slate-700',
    meaning: 'Sedang tugas lapangan / rute dokumen, pesan WhatsApp tetap diterima.'
  }
];

export interface OfficeStaffContact {
  id: string;
  index: string;
  division: StaffDivision;
  roleTitle: string;
  staffName: string;
  availabilityStatus: StaffAvailabilityStatus;
  availabilityDetail: string;
  operationalHours: string;
  phoneDisplay: string;
  whatsappNumber: string;
  description: string;
  commonTasks: string[];
  defaultMessage: string;
}

export interface OfficeDaySchedule {
  dayId: string;
  dayNameId: string;
  dayNameEn: string;
  hours: string;
  isClosed: boolean;
  note: string;
}

export interface RoomTimeSlot {
  time: string;
  status: 'Tersedia' | 'Terisi';
  bookedBy?: string;
  agenda?: string;
}

export interface DealingRoom {
  id: 'dealing-room-1' | 'dealing-room-2';
  tabLabel: 'Dealing Room 1' | 'Dealing Room 2';
  name: string;
  floorAndLocation: string;
  capacityPax: number;
  facilities: string;
  slots: RoomTimeSlot[];
}

export interface FloortimeSlot {
  id: string;
  dayLabel: string;
  shiftName: string;
  timeWindow: string;
  quotaMax: number;
  registeredAdvisors: {
    advisorName: string;
    corridorFocus: string;
  }[];
}

export const HERO_OFFICE_IMAGE = '/src/assets/images/hero_cibubur_office_1794295049336.jpg';

export const OFFICE_IDENTITY = {
  name: 'Brighton HUB Cibubur',
  address: 'Jl. Canadian Broadway Blok CBB 30–31, Kota Wisata Cibubur',
  phoneDisplay: '021 3873 9073',
  phoneHref: 'tel:02138739073',
  hoursSummary: 'Senin – Jumat: 08:00 – 17:00 WIB · Sabtu: 08:00 – 15:00 WIB · Minggu: Tutup'
};

export const WEEKLY_OFFICE_HOURS: OfficeDaySchedule[] = [
  {
    dayId: 'sun',
    dayNameId: 'Minggu',
    dayNameEn: 'Sunday',
    hours: 'Tutup (Closed)',
    isClosed: true,
    note: 'Layanan kantor tutup · Chat WhatsApp tetap dapat dikirim'
  },
  {
    dayId: 'mon',
    dayNameId: 'Senin',
    dayNameEn: 'Monday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: 'Operasional penuh · Ruang konsultasi & layanan dokumen aktif'
  },
  {
    dayId: 'tue',
    dayNameId: 'Selasa',
    dayNameEn: 'Tuesday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: 'Operasional penuh · Ruang konsultasi & layanan dokumen aktif'
  },
  {
    dayId: 'wed',
    dayNameId: 'Rabu',
    dayNameEn: 'Wednesday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: 'Operasional penuh · Ruang konsultasi & layanan dokumen aktif'
  },
  {
    dayId: 'thu',
    dayNameId: 'Kamis',
    dayNameEn: 'Thursday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: 'Operasional penuh · Ruang konsultasi & layanan dokumen aktif'
  },
  {
    dayId: 'fri',
    dayNameId: 'Jumat',
    dayNameEn: 'Friday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: 'Operasional penuh · Batas klaim komisi pukul 15:00 WIB'
  },
  {
    dayId: 'sat',
    dayNameId: 'Sabtu',
    dayNameEn: 'Saturday',
    hours: '08:00 - 15:00',
    isClosed: false,
    note: 'Operasional akhir pekan · Layanan hingga pukul 15:00 WIB'
  }
];

export const MORNING_INSPIRATIONS: MorningQuote[] = [
  {
    id: 'insp-1',
    title: 'Semangat Pagi · Brighton HUB Cibubur',
    quote:
      'Setiap kunci properti yang kita serahkan hari ini adalah awal dari cerita masa depan sebuah keluarga. Layani dengan ketulusan, kecepatan, dan integritas terbaik.',
    authorOrContext: 'Prinsip Pelayanan One Management · Brighton Real Estate',
    dailyFocus: 'Fokus Hari Ini: Respons cepat pelanggan & kerapian dokumen legalitas.'
  },
  {
    id: 'insp-2',
    title: 'Inspirasi Pagi · Kolaborasi Tim Cibubur',
    quote:
      'Keberhasilan satu transaksi adalah hasil kerja sama yang solid antara Property Advisor di lapangan dan dukungan penuh tim Operasional di kantor.',
    authorOrContext: 'Budaya Kerja Brighton HUB Cibubur · ISO 9001:2015',
    dailyFocus: 'Fokus Hari Ini: Koordinasi jadwal ruang konsultasi & ketepatan waktu kurir dokumen.'
  },
  {
    id: 'insp-3',
    title: 'Motivasi Pagi · Konsistensi & Kepercayaan',
    quote:
      'Kepercayaan klien dibangun dari hal-hal sederhana yang dilakukan secara konsisten: hadir tepat waktu, komunikasi yang jelas, dan administrasi yang transparan.',
    authorOrContext: 'Standar Layanan Prima · Koridor Kota Wisata & Cibubur',
    dailyFocus: 'Fokus Hari Ini: Verifikasi berkas komisi & kelancaran serah terima dokumen AJB.'
  }
];

export const OFFICE_STAFF_CONTACTS: OfficeStaffContact[] = [
  {
    id: 'staff-ops',
    index: '01',
    division: 'Operasional',
    roleTitle: 'Admin Operasional, Fasilitas Ruang & Jadwal Jaga',
    staffName: 'Rahmat Hidayat (Amat)',
    availabilityStatus: 'Online',
    availabilityDetail: 'Siap melayani di meja operasional kantor',
    operationalHours: 'Senin – Jumat 08:00 – 17:00 · Sabtu 08:00 – 15:00',
    phoneDisplay: '+62 821-2496-2159',
    whatsappNumber: '6282124962159',
    description:
      'Melayani peminjaman ruang diskusi klien, penjadwalan jaga harian agen, penitipan kunci properti (Titip Kunci), dan fasilitas kantor Brighton HUB Cibubur.',
    commonTasks: [
      'Reservasi Ruang Konsultasi Klien',
      'Penjadwalan Giliran Jaga Kantor',
      'Titip Kunci & Banner Listing'
    ],
    defaultMessage:
      'Halo Mas Amat (Operasional Brighton HUB Cibubur), saya ingin berkoordinasi mengenai layanan operasional dan fasilitas ruang kantor.'
  },
  {
    id: 'staff-finance',
    index: '02',
    division: 'Keuangan',
    roleTitle: 'Staf Keuangan, Komisi & Invoicing',
    staffName: 'Hania Sari (Hania)',
    availabilityStatus: 'Sibuk',
    availabilityDetail: 'Sedang verifikasi komisi · Respon ~10 mnt',
    operationalHours: 'Senin – Jumat 08:00 – 17:00 · Sabtu 08:00 – 15:00',
    phoneDisplay: '+62 877-8486-5791',
    whatsappNumber: '6287784865791',
    description:
      'Melayani pencairan komisi agen, pembuatan invoice klien, konfirmasi pembayaran tanda jadi (booking fee), serta perhitungan pajak transaksi (PPh & BPHTB).',
    commonTasks: [
      'Klaim & Pencairan Komisi',
      'Konfirmasi Tanda Jadi / Invoice',
      'Perhitungan Pajak Transaksi'
    ],
    defaultMessage:
      'Halo Mbak Hania (Keuangan Brighton HUB Cibubur), saya ingin melakukan konfirmasi terkait administrasi keuangan / dokumen komisi transaksi.'
  },
  {
    id: 'staff-courier',
    index: '03',
    division: 'Kurir & Dokumen',
    roleTitle: 'Layanan Messenger, Kurir & Antar-Jemput Berkas',
    staffName: 'Apriansyah Ilyas (Apry)',
    availabilityStatus: 'Di Luar Kantor',
    availabilityDetail: 'Rute antar berkas Notaris · Chat tetap aktif',
    operationalHours: 'Senin – Jumat 08:00 – 17:00 · Sabtu 08:00 – 15:00',
    phoneDisplay: '+62 895-3911-96166',
    whatsappNumber: '62895391196166',
    description:
      'Melayani pengiriman dan penjemputan dokumen penting (PPJB, berkas KPR Bank, kuitansi asli, dan kunci unit) di area Kota Wisata, CitraGran, Legenda Wisata, dan kantor Notaris/PPAT.',
    commonTasks: [
      'Antar-Jemput Dokumen Notaris/PPAT',
      'Pengiriman Berkas KPR ke Bank',
      'Pengantaran Kunci & Spanduk Area Cibubur'
    ],
    defaultMessage:
      'Halo Mas Apry (Messenger Brighton HUB Cibubur), saya ingin menjadwalkan pengiriman / penjemputan dokumen properti hari ini.'
  }
];

export const INITIAL_DEALING_ROOMS: DealingRoom[] = [
  {
    id: 'dealing-room-1',
    tabLabel: 'Dealing Room 1',
    name: 'Dealing Room 1 — Ruang Konsultasi Kaca Utama',
    floorAndLocation: 'Lantai 1 · Sayap Resepsionis Utama',
    capacityPax: 6,
    facilities: 'Layar Smart TV 65" · Wi-Fi Cepat · Meja Presentasi KPR',
    slots: [
      {
        time: '08:00 - 10:00',
        status: 'Terisi',
        bookedBy: 'Hendra Wijaya',
        agenda: 'Review PPJB Cluster Monaco'
      },
      { time: '10:00 - 12:00', status: 'Tersedia' },
      { time: '13:00 - 15:00', status: 'Tersedia' },
      {
        time: '15:00 - 17:00',
        status: 'Terisi',
        bookedBy: 'Reza Darmawan',
        agenda: 'Negosiasi Sewa Ruko CitraGran'
      }
    ]
  },
  {
    id: 'dealing-room-2',
    tabLabel: 'Dealing Room 2',
    name: 'Dealing Room 2 — Ruang Akad & Negosiasi Eksekutif',
    floorAndLocation: 'Lantai 2 · Zona Tenang Legal & Notaris',
    capacityPax: 10,
    facilities: 'Proyektor Ganda · Papan Tulis Kaca · Meja Akad PPAT',
    slots: [
      { time: '08:00 - 10:00', status: 'Tersedia' },
      {
        time: '10:00 - 12:00',
        status: 'Terisi',
        bookedBy: 'Dimas Prasetyo',
        agenda: 'Penandatanganan AJB dengan Rekanan PPAT'
      },
      { time: '13:00 - 15:00', status: 'Tersedia' },
      { time: '15:00 - 17:00', status: 'Tersedia' }
    ]
  }
];

export const INITIAL_FLOORTIME_SHIFTS: FloortimeSlot[] = [
  {
    id: 'ft-pagi',
    dayLabel: 'Senin – Sabtu',
    shiftName: 'Floortime Sesi Pagi',
    timeWindow: '08:00 - 11:30 WIB',
    quotaMax: 3,
    registeredAdvisors: [
      { advisorName: 'Hendra Wijaya', corridorFocus: 'Kota Wisata' },
      { advisorName: 'Nadia Pramesti', corridorFocus: 'Legenda Wisata' }
    ]
  },
  {
    id: 'ft-siang',
    dayLabel: 'Senin – Sabtu',
    shiftName: 'Floortime Sesi Siang',
    timeWindow: '11:30 - 14:30 WIB',
    quotaMax: 3,
    registeredAdvisors: [
      { advisorName: 'Reza Darmawan', corridorFocus: 'CitraGran & Ruko' }
    ]
  },
  {
    id: 'ft-sore',
    dayLabel: 'Senin – Jumat',
    shiftName: 'Floortime Sesi Sore',
    timeWindow: '14:30 - 17:00 WIB',
    quotaMax: 3,
    registeredAdvisors: [
      { advisorName: 'Dimas Prasetyo', corridorFocus: 'Komersial & Kavling' }
    ]
  }
];
