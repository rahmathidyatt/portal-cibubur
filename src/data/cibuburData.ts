export type StaffDivision = 'OPERASIONAL' | 'FINANCE' | 'MESSENGER';

export interface OfficeStaffContact {
  id: string;
  division: StaffDivision;
  staffName: string;
  phoneDisplay: string;
  whatsappNumber: string;
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

export type RoomSlotStatus = 'Tersedia' | 'Terisi' | 'Di Luar Jam' | 'Sudah Lewat';

export interface RoomTimeSlot {
  time: string;
  status: RoomSlotStatus;
  bookingId?: string;
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
  /** Hari aktif sesi: 0 = Minggu, 1 = Senin, ..., 6 = Sabtu */
  activeDays: number[];
  quotaMax: number;
  registeredAdvisors: {
    registrationId?: string;
    advisorName: string;
    corridorFocus: string;
  }[];
}

export const OFFICE_IDENTITY = {
  name: 'Brighton HUB Cibubur',
  address: 'Jl. Canadian Broadway Blok CBB 30–31, Kota Wisata Cibubur',
  phoneDisplay: '021 3873 9073',
  phoneHref: 'tel:02138739073',
  mapsUrl: 'https://maps.app.goo.gl/fbFsEzTkC3Jp9HEY6',
  /** Tanggal berdiri kantor (YYYY-MM-DD), dipakai untuk ulang tahun kantor. */
  foundedDate: '2023-05-03',
  /** Formulir order Smart Messenger (Google Form via bit.ly). */
  smartMessengerOrderUrl: 'https://bit.ly/FormOrderSmartMessengerHubCibubur'
};

export const WEEKLY_OFFICE_HOURS: OfficeDaySchedule[] = [
  {
    dayId: 'sun',
    dayNameId: 'Minggu',
    dayNameEn: 'Sunday',
    hours: 'Tutup',
    isClosed: true,
    note: 'Pesan WhatsApp tetap bisa dikirim'
  },
  {
    dayId: 'mon',
    dayNameId: 'Senin',
    dayNameEn: 'Monday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: ''
  },
  {
    dayId: 'tue',
    dayNameId: 'Selasa',
    dayNameEn: 'Tuesday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: ''
  },
  {
    dayId: 'wed',
    dayNameId: 'Rabu',
    dayNameEn: 'Wednesday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: ''
  },
  {
    dayId: 'thu',
    dayNameId: 'Kamis',
    dayNameEn: 'Thursday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: ''
  },
  {
    dayId: 'fri',
    dayNameId: 'Jumat',
    dayNameEn: 'Friday',
    hours: '08:00 - 17:00',
    isClosed: false,
    note: ''
  },
  {
    dayId: 'sat',
    dayNameId: 'Sabtu',
    dayNameEn: 'Saturday',
    hours: '08:00 - 15:00',
    isClosed: false,
    note: ''
  }
];

export const OFFICE_STAFF_CONTACTS: OfficeStaffContact[] = [
  {
    id: 'staff-ops',
    division: 'OPERASIONAL',
    staffName: 'Rahmat Hidayat (Amat)',
    phoneDisplay: '+62 821-2496-2159',
    whatsappNumber: '6282124962159',
    defaultMessage:
      'Halo Mas Amat (Operasional Brighton HUB Cibubur), saya ingin berkoordinasi mengenai layanan operasional kantor.'
  },
  {
    id: 'staff-finance',
    division: 'FINANCE',
    staffName: 'Hania Sari (Hania)',
    phoneDisplay: '+62 877-8486-5791',
    whatsappNumber: '6287784865791',
    defaultMessage:
      'Halo Mbak Hania (Finance Brighton HUB Cibubur), saya ingin melakukan konfirmasi terkait administrasi keuangan.'
  },
  {
    id: 'staff-courier',
    division: 'MESSENGER',
    staffName: 'Apriansyah Ilyas (Apry)',
    phoneDisplay: '+62 895-3911-96166',
    whatsappNumber: '62895391196166',
    defaultMessage:
      'Halo Mas Apry (Messenger Brighton HUB Cibubur), saya ingin menjadwalkan pengiriman / penjemputan dokumen.'
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
      { time: '08:00 - 10:00', status: 'Tersedia' },
      { time: '10:00 - 12:00', status: 'Tersedia' },
      { time: '13:00 - 15:00', status: 'Tersedia' },
      { time: '15:00 - 17:00', status: 'Tersedia' }
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
      { time: '10:00 - 12:00', status: 'Tersedia' },
      { time: '13:00 - 15:00', status: 'Tersedia' },
      { time: '15:00 - 17:00', status: 'Tersedia' }
    ]
  }
];

export const INITIAL_FLOORTIME_SHIFTS: FloortimeSlot[] = [
  {
    id: 'ft-pagi',
    dayLabel: 'Senin – Sabtu',
    activeDays: [1, 2, 3, 4, 5, 6],
    shiftName: 'Floortime Sesi Pagi',
    timeWindow: '08:00 - 11:30 WIB',
    quotaMax: 3,
    registeredAdvisors: []
  },
  {
    id: 'ft-siang',
    dayLabel: 'Senin – Sabtu',
    activeDays: [1, 2, 3, 4, 5, 6],
    shiftName: 'Floortime Sesi Siang',
    timeWindow: '11:30 - 14:30 WIB',
    quotaMax: 3,
    registeredAdvisors: []
  },
  {
    id: 'ft-sore',
    dayLabel: 'Senin – Jumat',
    activeDays: [1, 2, 3, 4, 5],
    shiftName: 'Floortime Sesi Sore',
    timeWindow: '14:30 - 17:00 WIB',
    quotaMax: 3,
    registeredAdvisors: []
  }
];
