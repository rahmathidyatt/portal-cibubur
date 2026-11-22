/**
 * Panduan Percakapan Frontliner: skrip telepon & chat untuk siapa pun yang standby di kantor.
 * Teks memakai dua tanda sederhana: [isian] tampil sebagai kotak kuning, **tebal** tampil tebal.
 */

export type GuideTone = 'gelap' | 'biru' | 'ungu';

export interface GuideBlock {
  /** Label pilihan, mis. "A · Titip Jual / Sewa" (kosong = tanpa label). */
  tag: string;
  tone: GuideTone;
  /** Kalimat-kalimat; dipisah garis putus-putus. */
  lines: string[];
}

export interface GuideStep {
  title: string;
  /** Keterangan kecil di samping judul, mis. "A & B". */
  note: string;
  blocks: GuideBlock[];
  /** Kotak lanjutan di bawah pilihan (opsional). */
  followLabel: string;
  followText: string;
  /** Daftar fasilitas berbentuk kotak (opsional). */
  chips: string[];
}

export interface CallGuide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: GuideStep[];
}

const step = (title: string, blocks: GuideBlock[], extra: Partial<GuideStep> = {}): GuideStep => ({
  title,
  note: '',
  blocks,
  followLabel: '',
  followText: '',
  chips: [],
  ...extra
});
const block = (lines: string[], tag = '', tone: GuideTone = 'gelap'): GuideBlock => ({ tag, tone, lines });

const OPENING = block([
  '“Brighton [nama Bisnis Unit/MTB], selamat [pagi/siang/sore], dengan [nama Anda]. Ada yang bisa kami bantu?”\n“Baik, saat ini kami terhubung dengan Bapak/Ibu atas nama siapa?”'
]);
const CLOSING = block(['“Terima kasih sudah menghubungi Brighton [nama Bisnis Unit/MTB]. Selamat [pagi/siang/sore] dan sehat selalu, Pak/Bu [nama].”']);

export const DEFAULT_GUIDES: CallGuide[] = [
  {
    id: 'telepon-chat',
    eyebrow: 'Brighton · Script telepon & chat',
    title: 'Panduan Percakapan Frontliner',
    subtitle: '',
    steps: [
      step('Salam pembuka', [OPENING]),
      step('Gali kebutuhan — pilih sesuai tujuan', [
        block(['“Baik, boleh saya tahu jenis properti yang ingin Bapak/Ibu titip jual atau sewakan, serta alamat lengkapnya?”'], 'A · Titip Jual / Sewa', 'gelap'),
        block(['“Spesifikasi properti yang dicari seperti apa, dan budgetnya berapa?”'], 'B · Cari Properti', 'biru')
      ]),
      step(
        'Minta & konfirmasi nomor WhatsApp',
        [
          block([
            '“Untuk proses selanjutnya, tim kami akan menghubungi Bapak/Ibu melalui WhatsApp. Boleh dibantu nomor WhatsApp yang masih aktif?”',
            '“Baik, kami konfirmasi ulang nomor WA-nya [08xx-xxxx-xxxx]. Apakah benar, Pak/Bu?”'
          ])
        ],
        { note: 'A & B' }
      ),
      step('Sampaikan keuntungan — jika tidak ada pertanyaan lagi', [
        block(
          ['“Kami ingin menyampaikan, saat Bapak/Ibu titip properti melalui Brighton akan mendapatkan fasilitas **free papan tanda, iklan online**, dan fasilitas lainnya.”'],
          'A · Titip Jual / Sewa',
          'gelap'
        ),
        block(
          ['“Kami ingin menyampaikan, ketika Bapak/Ibu mencari properti di Brighton, Bapak/Ibu **tidak perlu mengeluarkan komisi**. Tim Brighton akan mencarikan properti yang sesuai.”'],
          'B · Cari Properti',
          'biru'
        )
      ]),
      step('Penutup', [CLOSING], { note: 'A & B' })
    ]
  },
  {
    id: 'calon-agen',
    eyebrow: 'Brighton · Calon agen baru',
    title: 'Panduan Percakapan Frontliner',
    subtitle: 'Berminat Join Brighton',
    steps: [
      step('Salam pembuka', [OPENING]),
      step('Tanyakan siapa yang mengajak', [block(['“Sebelumnya, apakah ada Agen Brighton yang mengajak Bapak/Ibu [nama] untuk join Brighton?”'])]),
      step(
        'Pilih sesuai jawaban calon agen',
        [
          block(
            [
              '“Baik, kami proses pengecekan data Bapak/Ibu terlebih dahulu. Ke depannya tim kami akan menghubungi Bapak/Ibu. Apakah ada nomor WhatsApp yang masih aktif?”',
              '“Terima kasih, mohon ditunggu, kami akan segera menghubungi Bapak/Ibu kembali. Apa ada lagi yang bisa dibantu, Pak/Bu?”'
            ],
            'Ada agen · Sudah',
            'gelap'
          ),
          block(
            ['“Baik, untuk join menjadi agen Brighton, pertama-tama Bapak/Ibu dapat mengisi form registrasi yang akan kami kirimkan melalui WhatsApp. Apakah Bapak/Ibu mempunyai nomor WhatsApp yang masih aktif?”'],
            'Ada agen · Belum',
            'biru'
          ),
          block(
            ['“Baik, untuk bergabung menjadi agen Brighton, Bapak/Ibu dapat mengisi form registrasi yang akan kami kirim melalui WhatsApp. Apakah Bapak/Ibu memiliki nomor WhatsApp aktif yang bisa kami kirimkan link registrasinya?”'],
            'Tidak ada agen',
            'ungu'
          )
        ],
        {
          followLabel: 'Lalu, untuk kedua jawaban di atas:',
          followText: '“Terima kasih, mohon ditunggu, link registrasinya segera kami kirim. Ada yang bisa kami bantu lagi?”'
        }
      ),
      step(
        'Sampaikan keuntungan — jika tidak ada pertanyaan lagi',
        [block(['“Kami ingin sampaikan, jika Bapak/Ibu bergabung menjadi agen Brighton, Bapak/Ibu akan mendapatkan fasilitas seperti:”'])],
        { chips: ['Brighton Apps', 'Banner gratis', 'Kartu nama', 'Kelas training gratis'] }
      ),
      step('Penutup', [CLOSING])
    ]
  }
];

export type Segment = { kind: 'text' | 'slot' | 'bold'; text: string };

/** Pecah teks menjadi potongan biasa, [isian], dan **tebal**. */
export function segments(text: string): Segment[] {
  const out: Segment[] = [];
  const re = /\[([^\]\n]+)\]|\*\*([^*\n]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push({ kind: 'text', text: text.slice(last, m.index) });
    out.push(m[1] !== undefined ? { kind: 'slot', text: m[1] } : { kind: 'bold', text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

/** Pastikan data tersimpan punya bentuk yang benar; bila rusak, pakai bawaan. */
export function normalizeGuides(value: unknown): CallGuide[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_GUIDES;
  const str = (v: unknown, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');
  const tones: GuideTone[] = ['gelap', 'biru', 'ungu'];
  return value.slice(0, 10).map((g, gi) => {
    const r = (g ?? {}) as Record<string, unknown>;
    const steps = Array.isArray(r.steps) ? r.steps : [];
    return {
      id: str(r.id, 60) || `panduan-${gi + 1}`,
      eyebrow: str(r.eyebrow, 120),
      title: str(r.title, 120) || 'Panduan Percakapan',
      subtitle: str(r.subtitle, 120),
      steps: steps.slice(0, 15).map((s) => {
        const st = (s ?? {}) as Record<string, unknown>;
        const blocks = Array.isArray(st.blocks) ? st.blocks : [];
        return {
          title: str(st.title, 120),
          note: str(st.note, 40),
          followLabel: str(st.followLabel, 120),
          followText: str(st.followText),
          chips: (Array.isArray(st.chips) ? st.chips : []).map((c) => str(c, 60)).filter(Boolean).slice(0, 12),
          blocks: blocks.slice(0, 4).map((b) => {
            const bl = (b ?? {}) as Record<string, unknown>;
            return {
              tag: str(bl.tag, 60),
              tone: tones.includes(bl.tone as GuideTone) ? (bl.tone as GuideTone) : 'gelap',
              lines: (Array.isArray(bl.lines) ? bl.lines : []).map((l) => str(l, 1200)).filter((l) => l.trim()).slice(0, 6)
            };
          })
        };
      })
    };
  });
}

/** Kalimat dalam satu kotak, dipisah baris "---" saat diedit. */
export const linesToText = (lines: string[]) => lines.join('\n---\n');
export const textToLines = (text: string) =>
  text
    .split(/\n\s*-{3,}\s*\n/)
    .map((l) => l.trim())
    .filter(Boolean);
