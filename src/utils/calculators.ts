/**
 * Kalkulator estimasi transaksi properti. Hasilnya perkiraan, bukan angka resmi:
 * nilai akhir mengikuti bank, notaris/PPAT, dan peraturan daerah setempat.
 */

/** Cicilan bulanan KPR dengan bunga anuitas tetap. */
export function kprMonthlyPayment(principal: number, annualRatePct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

export interface KprResult {
  downPayment: number;
  principal: number;
  monthly: number;
  totalPaid: number;
  totalInterest: number;
}

export function calculateKpr(
  price: number,
  downPaymentPct: number,
  annualRatePct: number,
  years: number
): KprResult {
  const downPayment = Math.max(0, price * (downPaymentPct / 100));
  const principal = Math.max(0, price - downPayment);
  const monthly = kprMonthlyPayment(principal, annualRatePct, years);
  const totalPaid = monthly * Math.round(years * 12);
  return {
    downPayment,
    principal,
    monthly,
    totalPaid,
    totalInterest: Math.max(0, totalPaid - principal)
  };
}

/** BPHTB pembeli = tarif × (NPOP − NPOPTKP), minimal 0. Tarif maksimal 5% (UU HKPD). */
export function calculateBphtb(npop: number, npoptkp: number, ratePct: number = 5): number {
  return Math.max(0, npop - npoptkp) * (ratePct / 100);
}

/** PPh final penjual atas pengalihan hak tanah/bangunan (umumnya 2,5%, PP 34/2016). */
export function calculatePphFinal(transactionValue: number, ratePct: number = 2.5): number {
  return Math.max(0, transactionValue) * (ratePct / 100);
}

export interface CommissionResult {
  gross: number;
  advisorShare: number;
  officeShare: number;
}

export function calculateCommission(
  transactionValue: number,
  commissionPct: number,
  advisorSharePct: number
): CommissionResult {
  const gross = Math.max(0, transactionValue) * (commissionPct / 100);
  const advisorShare = gross * (Math.min(100, Math.max(0, advisorSharePct)) / 100);
  return { gross, advisorShare, officeShare: gross - advisorShare };
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

/** "1.250.000.000" → 1250000000 */
export function parseRupiahInput(text: string): number {
  const digits = text.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

export function formatThousands(value: number): string {
  return value ? new Intl.NumberFormat('id-ID').format(value) : '';
}
