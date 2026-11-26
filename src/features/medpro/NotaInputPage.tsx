import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Loader2, Save, ScanLine, Upload } from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { aiErrorMessage, scanNotaImage } from '../../services/aiClient';
import { getMedproStore } from './medproStore';
import { normalizeInvoice } from './medpro';
import { buildNotaZip, loadImage, renderItemCanvas } from './notaRender';
import { checkNota, hasBox, itemFileName, normalizeScan, notaNumber, uniqueNames, type NotaCategory, type NotaItem, type NotaScan } from './notaSplit';

const input =
  'w-full px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400';
const card = 'rounded-2xl bg-white p-5 ring-1 ring-slate-200';
const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-950 bg-amber-400 hover:bg-amber-500 rounded-lg disabled:opacity-50 cursor-pointer';
const ghostBtn =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-800 bg-white ring-1 ring-slate-300 hover:bg-slate-50 rounded-lg disabled:opacity-50 cursor-pointer';

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

/** Menu admin Nota Medpro › Input nota: foto nota → dibaca Gemini → dibagi per baris → dicek → ZIP & simpan. */
export const NotaInputPage: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scan, setScan] = useState<NotaScan | null>(null);
  const [busy, setBusy] = useState<'scan' | 'zip' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previews, setPreviews] = useState<string[]>([]);

  const check = useMemo(() => (scan ? checkNota(scan) : null), [scan]);
  const names = useMemo(() => (scan ? uniqueNames(scan.items.map((it) => itemFileName(it))) : []), [scan]);

  // Gambar contoh hasil per baris (kecil) untuk dicek sebelum diunduh.
  useEffect(() => {
    if (!img || !scan) return setPreviews([]);
    setPreviews(scan.items.map((it) => renderItemCanvas(img, scan.paper, it, 560).toDataURL('image/jpeg', 0.8)));
  }, [img, scan]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setScan(null);
    try {
      const { compressPhoto } = await import('../../utils/image');
      const dataUrl = await compressPhoto(file, 2400, 0.9);
      setPhoto(dataUrl);
      setImg(await loadImage(dataUrl));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto nota gagal dibaca.');
    }
  };

  const read = async () => {
    if (!photo) return;
    setBusy('scan');
    setError(null);
    try {
      const { compressPhoto } = await import('../../utils/image');
      const blob = await (await fetch(photo)).blob();
      const small = await compressPhoto(new File([blob], 'nota.jpg', { type: blob.type }), 1800, 0.85);
      const { data: raw, error: code } = await scanNotaImage(small, auth.accessToken);
      if (!raw) throw new Error(aiErrorMessage(code));
      const result = normalizeScan(raw);
      if (result.items.length === 0) throw new Error('Tidak ada baris item yang terbaca. Coba foto ulang dengan lebih jelas & lurus.');
      setScan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membaca nota.');
    } finally {
      setBusy(null);
    }
  };

  const setItem = (i: number, patch: Partial<NotaItem>) =>
    setScan((s) => (s ? { ...s, items: s.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : s));

  const download = async () => {
    if (!img || !scan) return;
    setBusy('zip');
    try {
      const { blob, fileName } = await buildNotaZip(img, scan);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat ZIP.', 'error');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!scan || !check?.ok) return;
    const invoice = normalizeInvoice(scan.invoice);
    if (!/^\d{5,7}\//.test(invoice)) return setError('Nomor nota belum lengkap, mis. 022642/ASP/FP/XI/2026.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scan.date)) return setError('Isi tanggal nota.');
    setBusy('save');
    setError(null);
    try {
      const store = getMedproStore();
      const existing = await store.listNotas(auth);
      if (existing.some((n) => normalizeInvoice(n.invoice) === invoice)) {
        setError(`Nota ${invoice} sudah ada di Nota Medpro, tidak disimpan dua kali.`);
        return;
      }
      await store.addNota(
        {
          date: scan.date,
          invoice,
          banner: check.banner,
          branding: check.branding,
          // Belum dicentang: dicek dulu dengan harga akhir di web Brighton resmi.
          checked: false,
          paidOn: null,
          items: scan.items.map(({ description, product, label, size, price, qty, total, category }) => ({
            description,
            product,
            label,
            size,
            price,
            qty,
            total,
            category
          }))
        },
        auth
      );
      toast(`Nota ${notaNumber(invoice)} tersimpan. Centang "Sesuai" di Data nota setelah dicek dengan web Brighton.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan ke Nota Medpro.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Operasional · Nota Medpro</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Input nota</h1>

        {/* 1. Foto nota */}
        <div className={`${card} mt-6`}>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} className={ghostBtn}>
              <Upload className="h-4 w-4" /> {photo ? 'Ganti foto nota' : 'Unggah foto nota'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Foto nota"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                void pick(f);
              }}
            />
            <button type="button" onClick={() => void read()} disabled={!photo || busy !== null} className={primaryBtn}>
              {busy === 'scan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
              {busy === 'scan' ? 'Membaca nota… (±30–60 detik)' : 'Baca & bagi nota'}
            </button>
          </div>
          {photo && !scan && <img src={photo} alt="Foto nota" className="mt-4 max-h-80 rounded-lg ring-1 ring-slate-200" />}
          {error && (
            <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </p>
          )}
        </div>

        {scan && check && (
          <>
            {/* 2. Hasil baca & pengecekan */}
            <div className={`${card} mt-4`}>
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <label className="text-xs font-semibold text-slate-700">
                  Nomor nota
                  <input className={`${input} mt-1 font-mono`} value={scan.invoice} onChange={(e) => setScan({ ...scan, invoice: e.target.value })} />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Tanggal nota
                  <input type="date" className={`${input} mt-1`} value={scan.date} onChange={(e) => setScan({ ...scan, date: e.target.value })} />
                </label>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-2 pr-2 font-semibold">No</th>
                      <th className="py-2 pr-2 font-semibold">Nama</th>
                      <th className="py-2 pr-2 font-semibold">Ukuran</th>
                      <th className="py-2 pr-2 font-semibold">Kategori</th>
                      <th className="py-2 pr-2 font-semibold text-right">Harga</th>
                      <th className="py-2 pr-2 font-semibold text-right">Qty</th>
                      <th className="py-2 font-semibold text-right">Jumlah harga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scan.items.map((it, i) => {
                      const bad = check.badLines.includes(i);
                      return (
                        <tr key={i} className={bad ? 'bg-red-50' : ''}>
                          <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                          <td className="py-2 pr-2">
                            <input className={input} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} aria-label={`Nama baris ${i + 1}`} />
                            <p className="mt-0.5 truncate text-[11px] text-slate-500" title={it.description}>
                              {it.product || it.description}
                            </p>
                          </td>
                          <td className="py-2 pr-2 w-32">
                            <input className={input} value={it.size} onChange={(e) => setItem(i, { size: e.target.value })} aria-label={`Ukuran baris ${i + 1}`} />
                          </td>
                          <td className="py-2 pr-2 w-40">
                            <select
                              className={input}
                              value={it.category}
                              onChange={(e) => setItem(i, { category: e.target.value as NotaCategory })}
                              aria-label={`Kategori baris ${i + 1}`}
                            >
                              <option value="banner">Banner/Plank</option>
                              <option value="branding">Alat Branding</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2 w-28">
                            <input className={`${input} text-right tabular-nums`} inputMode="numeric" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`Harga baris ${i + 1}`} />
                          </td>
                          <td className="py-2 pr-2 w-16">
                            <input className={`${input} text-right tabular-nums`} inputMode="numeric" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`Qty baris ${i + 1}`} />
                          </td>
                          <td className="py-2 w-28">
                            <input className={`${input} text-right tabular-nums ${bad ? 'border-red-400' : ''}`} inputMode="numeric" value={it.total} onChange={(e) => setItem(i, { total: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label={`Jumlah harga baris ${i + 1}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 text-sm">
                      <td colSpan={5} className="py-2 pr-2 text-right font-semibold text-slate-700">Jumlah di nota</td>
                      <td className="py-2 pr-2">
                        <input className={`${input} text-right tabular-nums ${check.qtyOk ? '' : 'border-red-400'}`} inputMode="numeric" value={scan.totalQty} onChange={(e) => setScan({ ...scan, totalQty: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Jumlah qty di nota" />
                      </td>
                      <td className="py-2">
                        <input className={`${input} text-right tabular-nums ${check.totalOk ? '' : 'border-red-400'}`} inputMode="numeric" value={scan.grandTotal} onChange={(e) => setScan({ ...scan, grandTotal: Number(e.target.value.replace(/\D/g, '')) || 0 })} aria-label="Jumlah harga di nota" />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {scan.items.some((it) => !hasBox(it)) && (
                <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Kotak merah belum terbaca untuk {scan.items.filter((it) => !hasBox(it)).length} baris. Klik "Baca &amp; bagi nota" lagi sebelum download.
                </p>
              )}

              <div
                className={`mt-4 rounded-xl px-4 py-3 text-sm ring-1 ${
                  check.ok ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200'
                }`}
              >
                {check.ok ? (
                  <p className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="h-4 w-4" /> Nota sesuai: {scan.items.length} baris, {check.sumQty} pcs, {rupiah(check.sumTotal)}.
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {check.badLines.map((i) => (
                      <li key={i}>
                        Baris {i + 1}: {rupiah(scan.items[i].price)} × {scan.items[i].qty} ≠ {rupiah(scan.items[i].total)}
                      </li>
                    ))}
                    {!check.qtyOk && (
                      <li>
                        Total qty baris {check.sumQty} ≠ jumlah di nota {scan.totalQty}
                      </li>
                    )}
                    {!check.totalOk && (
                      <li>
                        Total harga baris {rupiah(check.sumTotal)} ≠ jumlah di nota {rupiah(scan.grandTotal)}
                      </li>
                    )}
                  </ul>
                )}
                <p className="mt-1 text-xs">
                  Banner/Plank {rupiah(check.banner)} · Alat Branding {rupiah(check.branding)}
                </p>
              </div>
            </div>

            {/* 3. Hasil potongan per baris */}
            <div className={`${card} mt-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-950">
                  Hasil pembagian ({scan.items.length} nota) · {notaNumber(scan.invoice)}.zip
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void download()} disabled={busy !== null} className={ghostBtn}>
                    <Download className="h-4 w-4" /> {busy === 'zip' ? 'Menyiapkan…' : `Unduh ${notaNumber(scan.invoice)}.zip`}
                  </button>
                  <button type="button" onClick={() => void save()} disabled={busy !== null || !check.ok} className={primaryBtn} title={check.ok ? '' : 'Perbaiki dulu angka yang belum sesuai'}>
                    <Save className="h-4 w-4" /> {busy === 'save' ? 'Menyimpan…' : 'Simpan ke Nota Medpro'}
                  </button>
                </div>
              </div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {previews.map((src, i) => (
                  <li key={i} className="overflow-hidden rounded-xl ring-1 ring-slate-200">
                    <img src={src} alt={names[i]} className="w-full bg-stone-100" />
                    <p className="truncate px-3 py-2 text-xs font-bold text-slate-900" title={`${names[i]}.jpg`}>
                      {names[i]}.jpg
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  );
};
