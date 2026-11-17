import { formatRupiah, type NotaJob, type NotaMeta, type NotaResult } from './notaCalc';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function formatLongDate(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

/** Salam sesuai jam WIB (menit sejak 00.00). */
export function greeting(minutes: number): string {
  if (minutes < 11 * 60) return 'Selamat pagi';
  if (minutes < 15 * 60) return 'Selamat siang';
  if (minutes < 18 * 60) return 'Selamat sore';
  return 'Selamat malam';
}

function filledJobs(jobs: NotaJob[]): NotaJob[] {
  return jobs.filter((j) => j.alamat.trim() || j.tugas.trim());
}

function jobLines(jobs: NotaJob[]): string[] {
  return filledJobs(jobs).map((j, i) => {
    const parts = [j.alamat.trim(), j.tugas.trim()].filter(Boolean).join(' — ');
    return `${i + 1}. ${parts}${j.keterangan.trim() ? ` (${j.keterangan.trim()})` : ''}`;
  });
}

function addressee(meta: NotaMeta): string {
  const name = meta.namaAgent.trim();
  return name ? `Bapak/Ibu ${name}` : 'Bapak/Ibu';
}

/** Pesan formal saat mengirim nota Smart Messenger kepada agen. */
export function buildNotaMessage(meta: NotaMeta, jobs: NotaJob[], result: NotaResult, minutes: number): string {
  const lines = [
    `${greeting(minutes)} ${addressee(meta)},`,
    '',
    `Bersama pesan ini kami sampaikan nota *Smart Messenger* Brighton ${meta.kantor.trim() || 'HUB Cibubur'} atas permintaan tanggal ${formatLongDate(meta.tglRequest)}, dengan estimasi pengerjaan ${formatLongDate(meta.estimasiTanggal)}.`,
    ''
  ];
  const jl = jobLines(jobs);
  if (jl.length) lines.push('*Rincian pekerjaan:*', ...jl, '');
  lines.push(`*Total tagihan: ${formatRupiah(result.total)}*`);
  if (result.minimumApplied) lines.push(`(${result.minimumNote})`);
  lines.push(`Metode pembayaran: ${meta.pembayaran}`);
  if (/transfer/i.test(meta.pembayaran) && meta.rekening.trim()) lines.push(`No. rekening: ${meta.rekening.trim()}`);
  lines.push(
    '',
    'Nota lengkap kami lampirkan. Mohon kesediaannya untuk melakukan pembayaran dan mengirimkan bukti transfer setelah selesai.',
    'Apabila ada hal yang kurang sesuai, silakan menghubungi kami.',
    '',
    'Terima kasih atas kepercayaannya.',
    '',
    'Hormat kami,',
    `Operasional Brighton ${meta.kantor.trim() || 'HUB Cibubur'}`
  );
  return lines.join('\n');
}

/** Pesan pengantar saat mengirim foto dokumentasi hasil pekerjaan messenger. */
export function buildPhotoMessage(meta: NotaMeta, jobs: NotaJob[], minutes: number): string {
  const lines = [
    `${greeting(minutes)} ${addressee(meta)},`,
    '',
    `Berikut kami kirimkan foto dokumentasi hasil pekerjaan *Smart Messenger* tanggal ${formatLongDate(meta.estimasiTanggal)}:`
  ];
  const jl = jobLines(jobs);
  if (jl.length) lines.push('', ...jl);
  lines.push(
    '',
    'Mohon dicek kembali. Apabila ada yang perlu disesuaikan, silakan sampaikan kepada kami.',
    '',
    'Terima kasih.',
    '',
    'Hormat kami,',
    `Operasional Brighton ${meta.kantor.trim() || 'HUB Cibubur'}`
  );
  return lines.join('\n');
}
