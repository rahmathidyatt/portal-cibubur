import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  Minimize2,
  Download,
  Eraser,
  EyeOff,
  FileText,
  LayoutTemplate,
  Loader2,
  ScanSearch,
  Sparkles,
  Undo2,
  WandSparkles
} from 'lucide-react';
import { useAdmin } from '../../hooks/useAdmin';
import { useToast } from '../../hooks/useToast';
import { aiErrorMessage, studioFind, studioFlyerText, studioListingText } from '../../services/aiClient';
import { compressToTarget, formatBytes } from './compress';
import { blurMasked, DEFAULT_ENHANCE, dilate, enhance, inpaint, type Box, type EnhanceOptions } from './imageOps';
import {
  canvasToBlob,
  downloadBlob,
  downloadCanvas,
  FLYER_SIZE,
  loadFonts,
  renderFlyer,
  slugName,
  type FlyerData,
  type FlyerFormat
} from './studioRender';
import {
  canvasForAi,
  CanvasView,
  scaleCanvas,
  card,
  cloneCanvas,
  fileToCanvas,
  ghostBtn,
  input,
  label,
  MaskEditor,
  nextFrame,
  PhotoButton,
  primaryBtn,
  type MaskHandle
} from './StudioShared';

type Tool = 'hd' | 'edit' | 'flyer' | 'listing' | 'ukuran';

const TOOLS: { id: Tool; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'hd', label: 'HD foto', Icon: WandSparkles },
  { id: 'edit', label: 'Hapus objek & samarkan', Icon: Eraser },
  { id: 'flyer', label: 'Flyer', Icon: LayoutTemplate },
  { id: 'listing', label: 'Deskripsi listing', Icon: FileText },
  { id: 'ukuran', label: 'Kompres foto', Icon: Minimize2 }
];

/** Data properti & agen untuk Flyer. */
export interface PropertyForm {
  status: string;
  title: string;
  location: string;
  price: string;
  lt: string;
  lb: string;
  kt: string;
  km: string;
  agentName: string;
  agentWa: string;
}

const EMPTY_FORM: PropertyForm = {
  status: 'Dijual',
  title: '',
  location: '',
  price: '',
  lt: '',
  lb: '',
  kt: '',
  km: '',
  agentName: '',
  agentWa: ''
};

/** Menu Studio Agen (khusus admin): alat bantu foto & materi promosi listing. */
export const StudioPage: React.FC = () => {
  const [tool, setTool] = useState<Tool>('hd');
  const [form, setForm] = useState<PropertyForm>(EMPTY_FORM);

  useEffect(() => {
    void loadFonts();
  }, []);

  return (
    <section className="bg-stone-50 min-h-[70vh]">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <p className="text-xs text-slate-500">Alat bantu agen</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Studio Agen</h1>

        <div role="tablist" aria-label="Alat Studio Agen" className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {TOOLS.map(({ id, label: text, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tool === id}
              onClick={() => setTool(id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                tool === id ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:text-slate-950'
              }`}
            >
              <Icon className={`h-4 w-4 ${tool === id ? 'text-amber-400' : 'text-amber-600'}`} />
              {text}
            </button>
          ))}
        </div>

        {/* Semua alat tetap terpasang agar foto & isian tidak hilang saat berpindah tab. */}
        <div className="mt-5">
          <div hidden={tool !== 'hd'}>
            <HdTool />
          </div>
          <div hidden={tool !== 'edit'}>
            <EditTool />
          </div>
          <div hidden={tool !== 'flyer'}>
            <FlyerTool form={form} setForm={setForm} />
          </div>
          <div hidden={tool !== 'listing'}>
            <ListingTool />
          </div>
          <div hidden={tool !== 'ukuran'}>
            <CompressTool />
          </div>
        </div>
      </div>
    </section>
  );
};

const ErrorLine: React.FC<{ text: string | null }> = ({ text }) =>
  text ? (
    <p className="mt-3 flex items-start gap-1.5 text-sm font-semibold text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {text}
    </p>
  ) : null;

const Slider: React.FC<{ text: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({
  text,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05
}) => (
  <label className="block text-sm">
    <span className="flex justify-between font-semibold text-slate-700">
      {text} <span className="tabular-nums text-slate-500">{Math.round(((value - min) / (max - min)) * 100)}%</span>
    </span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" aria-label={text} />
  </label>
);

/* ------------------------------------------------------------------ HD */

const HdTool: React.FC = () => {
  const [src, setSrc] = useState<HTMLCanvasElement | null>(null);
  const [name, setName] = useState('foto');
  const [out, setOut] = useState<HTMLCanvasElement | null>(null);
  const [opt, setOpt] = useState<EnhanceOptions>(DEFAULT_ENHANCE);
  const [upscale, setUpscale] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!src) return;
    setBusy(true);
    setError(null);
    await nextFrame();
    try {
      const factor = upscale ? Math.min(2, 3200 / Math.max(src.width, src.height)) : 1;
      const c = document.createElement('canvas');
      c.width = Math.round(src.width * Math.max(1, factor));
      c.height = Math.round(src.height * Math.max(1, factor));
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      enhance({ data: img.data, width: c.width, height: c.height }, opt);
      ctx.putImageData(img, 0, 0);
      setOut(c);
    } catch {
      setError('Foto terlalu besar untuk diproses di perangkat ini. Coba foto yang lebih kecil.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <PhotoButton
          text={src ? 'Ganti foto' : 'Unggah foto'}
          primary={!src}
          onFiles={async ([f]) => {
            try {
              setError(null);
              setOut(null);
              setName(slugName(f.name.replace(/\.[^.]+$/, ''), 'foto'));
              setSrc(await fileToCanvas(f, 2048));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
        {src && (
          <button type="button" className={primaryBtn} disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />} {busy ? 'Memproses…' : 'Jadikan HD'}
          </button>
        )}
        {out && (
          <button type="button" className={ghostBtn} onClick={() => void downloadCanvas(out, `${name}-hd.jpg`)}>
            <Download className="h-4 w-4" /> Download
          </button>
        )}
      </div>
      <ErrorLine text={error} />

      {src && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={upscale} onChange={(e) => setUpscale(e.target.checked)} /> Perbesar 2× resolusi
            </label>
            <Slider text="Ketajaman" value={opt.sharpen} onChange={(v) => setOpt({ ...opt, sharpen: v })} />
            <Slider text="Kecerahan & kontras otomatis" value={opt.autoLevel} onChange={(v) => setOpt({ ...opt, autoLevel: v })} />
            <Slider text="Warna" value={opt.vibrance} onChange={(v) => setOpt({ ...opt, vibrance: v })} />
            <p className="text-xs text-slate-500">
              {src.width}×{src.height} px{out ? ` → ${out.width}×${out.height} px` : ''}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-1 text-xs font-semibold text-slate-500">Sebelum</figcaption>
              <CanvasView canvas={src} alt="Foto sebelum" />
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs font-semibold text-slate-500">Sesudah</figcaption>
              {out ? (
                <CanvasView canvas={out} alt="Foto sesudah" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center rounded-lg bg-slate-100 text-sm text-slate-400 ring-1 ring-slate-200">Klik "Jadikan HD"</div>
              )}
            </figure>
          </div>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------- edit foto: hapus objek / samarkan */

type EditAction = 'hapus' | 'samarkan';

const EditTool: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const maskRef = useRef<MaskHandle>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [undoStack, setUndoStack] = useState<HTMLCanvasElement[]>([]);
  const [name, setName] = useState('foto');
  const [hasMask, setHasMask] = useState(false);
  const [action, setAction] = useState<EditAction>('hapus');
  const [busy, setBusy] = useState<'number' | 'privacy' | 'apply' | null>(null);
  const [strength, setStrength] = useState(2);
  const [error, setError] = useState<string | null>(null);

  const find = async (target: 'number' | 'privacy') => {
    if (!base) return;
    setBusy(target);
    setError(null);
    const { data, error: code } = await studioFind(canvasForAi(base), target, auth.accessToken);
    setBusy(null);
    if (!data) return setError(aiErrorMessage(code));
    const boxes = (data.items ?? []).map((it) => it.box_2d as Box);
    if (boxes.length === 0)
      return toast(target === 'number' ? 'Tidak ada nomor rumah yang terlihat. Tandai manual dengan kuas.' : 'Tidak ada wajah/plat yang terlihat.');
    maskRef.current?.addBoxes(boxes, target === 'number' ? 0.15 : 0.2);
    // Nomor rumah biasanya dihapus, wajah & plat biasanya disamarkan.
    const next: EditAction = target === 'number' ? 'hapus' : 'samarkan';
    setAction(next);
    toast(`${boxes.length} area ditandai. Periksa, lalu klik "${next === 'hapus' ? 'Hapus objek' : 'Samarkan'}".`, 'success');
  };

  const apply = async () => {
    if (!base || !maskRef.current) return;
    setBusy('apply');
    await nextFrame();
    try {
      const w = base.width;
      const h = base.height;
      const next = cloneCanvas(base);
      const ctx = next.getContext('2d')!;
      const img = ctx.getImageData(0, 0, w, h);
      const raw = maskRef.current.getMask();
      if (action === 'hapus') inpaint({ data: img.data, width: w, height: h }, dilate(raw, w, h, Math.max(2, Math.round(Math.max(w, h) / 500))));
      else blurMasked({ data: img.data, width: w, height: h }, raw, strength);
      ctx.putImageData(img, 0, 0);
      setUndoStack((st) => [...st.slice(-9), base]);
      setBase(next);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <PhotoButton
          text={base ? 'Ganti foto' : 'Unggah foto'}
          primary={!base}
          onFiles={async ([f]) => {
            try {
              setError(null);
              setUndoStack([]);
              setName(slugName(f.name.replace(/\.[^.]+$/, ''), 'foto'));
              setBase(await fileToCanvas(f, 2048));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        />
        {base && (
          <>
            <button
              type="button"
              className={ghostBtn}
              disabled={undoStack.length === 0 || busy !== null}
              onClick={() => {
                const prev = undoStack[undoStack.length - 1];
                if (!prev) return;
                setUndoStack((st) => st.slice(0, -1));
                setBase(prev);
              }}
            >
              <Undo2 className="h-4 w-4" /> Batalkan hasil
            </button>
            <button type="button" className={ghostBtn} onClick={() => void downloadCanvas(base, `${name}-edit.jpg`)}>
              <Download className="h-4 w-4" /> Download
            </button>
          </>
        )}
      </div>
      <ErrorLine text={error} />
      {base && (
        <div className="mt-5 grid gap-5 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <div>
              <span className={label}>1. Tandai area</span>
              <p className="text-sm text-slate-600">Warnai dengan kuas, atau cari otomatis:</p>
              <div className="mt-2 flex flex-col gap-2">
                <button type="button" className={ghostBtn} disabled={busy !== null} onClick={() => void find('number')}>
                  {busy === 'number' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                  {busy === 'number' ? 'Mencari…' : 'Cari nomor rumah'}
                </button>
                <button type="button" className={ghostBtn} disabled={busy !== null} onClick={() => void find('privacy')}>
                  {busy === 'privacy' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                  {busy === 'privacy' ? 'Mencari…' : 'Cari wajah & plat'}
                </button>
              </div>
            </div>
            <fieldset>
              <legend className={label}>2. Pilih tindakan</legend>
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    ['hapus', 'Hapus objek', Eraser],
                    ['samarkan', 'Samarkan', EyeOff]
                  ] as const
                ).map(([id, text, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={action === id}
                    onClick={() => setAction(id)}
                    className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold cursor-pointer ${
                      action === id ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    <Icon className="h-4 w-4 text-amber-600" /> {text}
                  </button>
                ))}
              </div>
              {action === 'samarkan' && (
                <div className="mt-3">
                  <Slider text="Kekuatan blur" value={strength} min={1} max={4} step={0.25} onChange={setStrength} />
                </div>
              )}
            </fieldset>
            <button type="button" className={`${primaryBtn} w-full`} disabled={busy !== null || !hasMask} onClick={() => void apply()}>
              {busy === 'apply' ? <Loader2 className="h-4 w-4 animate-spin" /> : action === 'hapus' ? <Eraser className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {busy === 'apply' ? 'Memproses…' : action === 'hapus' ? '3. Hapus objek' : '3. Samarkan'}
            </button>
          </div>
          <MaskEditor base={base} handle={maskRef} onChange={setHasMask} />
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------------- forms */

const FormField: React.FC<{
  id: keyof PropertyForm;
  text: string;
  form: PropertyForm;
  setForm: React.Dispatch<React.SetStateAction<PropertyForm>>;
  placeholder?: string;
  numeric?: boolean;
}> = ({ id, text, form, setForm, placeholder, numeric }) => (
  <label className="block">
    <span className={label}>{text}</span>
    <input
      className={input}
      value={form[id]}
      inputMode={numeric ? 'numeric' : undefined}
      placeholder={placeholder}
      onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
    />
  </label>
);

const PropertyFields: React.FC<{ form: PropertyForm; setForm: React.Dispatch<React.SetStateAction<PropertyForm>> }> = ({ form, setForm }) => (
  <div className="grid grid-cols-2 gap-3">
    <label className="block">
      <span className={label}>Status</span>
      <select className={input} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
        <option>Dijual</option>
        <option>Disewa</option>
        <option>Dijual / Disewa</option>
      </select>
    </label>
    <FormField id="price" text="Harga" placeholder="Rp1,2 M" form={form} setForm={setForm} />
    <div className="col-span-2">
      <FormField id="title" text="Jenis / nama properti" placeholder="Rumah 2 lantai Citra Gran" form={form} setForm={setForm} />
    </div>
    <div className="col-span-2">
      <FormField id="location" text="Lokasi" placeholder="Cibubur, Jakarta Timur" form={form} setForm={setForm} />
    </div>
    <FormField id="lt" text="Luas tanah (m²)" numeric form={form} setForm={setForm} />
    <FormField id="lb" text="Luas bangunan (m²)" numeric form={form} setForm={setForm} />
    <FormField id="kt" text="Kamar tidur" numeric form={form} setForm={setForm} />
    <FormField id="km" text="Kamar mandi" numeric form={form} setForm={setForm} />
    <FormField id="agentName" text="Nama agen" form={form} setForm={setForm} />
    <FormField id="agentWa" text="No. WA agen" placeholder="0812-xxxx-xxxx" form={form} setForm={setForm} />
  </div>
);

const formData = (f: PropertyForm): Record<string, string> => ({
  status: f.status,
  jenis: f.title,
  lokasi: f.location,
  harga: f.price,
  luas_tanah_m2: f.lt,
  luas_bangunan_m2: f.lb,
  kamar_tidur: f.kt,
  kamar_mandi: f.km,
  nama_agen: f.agentName,
  wa_agen: f.agentWa
});

/* ---------------------------------------------------------------- flyer */

const FlyerTool: React.FC<{ form: PropertyForm; setForm: React.Dispatch<React.SetStateAction<PropertyForm>> }> = ({ form, setForm }) => {
  const { auth } = useAdmin();
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [agentPhoto, setAgentPhoto] = useState<HTMLCanvasElement | null>(null);
  const [prompt, setPrompt] = useState('');
  const [headline, setHeadline] = useState('');
  const [highlights, setHighlights] = useState('');
  const [cta, setCta] = useState('Hubungi Sekarang');
  const [format, setFormat] = useState<FlyerFormat>('feed');
  const [focusY, setFocusY] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    void loadFonts().then(() => setFontsReady(true));
  }, []);

  const data: FlyerData = {
    status: form.status,
    headline: headline || form.title,
    location: form.location,
    price: form.price,
    lt: form.lt,
    lb: form.lb,
    kt: form.kt,
    km: form.km,
    highlights: highlights.split('\n'),
    cta,
    agentName: form.agentName,
    agentWa: form.agentWa
  };

  const preview = useMemo(
    () => (photo && fontsReady ? renderFlyer(photo, data, format, agentPhoto, focusY) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photo, agentPhoto, format, focusY, fontsReady, JSON.stringify(data)]
  );

  const write = async () => {
    setBusy(true);
    setError(null);
    const { data: out, error: code } = await studioFlyerText(prompt, formData(form), auth.accessToken);
    setBusy(false);
    if (!out?.headline) return setError(aiErrorMessage(code));
    setHeadline(out.headline);
    setHighlights((out.highlights ?? []).join('\n'));
    if (out.cta) setCta(out.cta);
  };

  const download = async (f: FlyerFormat) => {
    if (!photo) return;
    await downloadCanvas(renderFlyer(photo, data, f, agentPhoto, focusY), `flyer-${slugName(form.title || headline)}-${f}.jpg`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap gap-2">
          <PhotoButton text={photo ? 'Ganti foto properti' : 'Unggah foto properti'} primary={!photo} onFiles={([f]) => void fileToCanvas(f, 2400).then(setPhoto, (e: Error) => setError(e.message))} />
          <PhotoButton text={agentPhoto ? 'Ganti foto agen' : 'Foto agen (opsional)'} onFiles={([f]) => void fileToCanvas(f, 600).then(setAgentPhoto, (e: Error) => setError(e.message))} />
        </div>
        <label className="block">
          <span className={label}>Permintaan agen (prompt)</span>
          <textarea
            className={`${input} min-h-[84px]`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Contoh: rumah hook dekat tol Cibubur, cocok untuk keluarga muda, sudah renovasi, carport 2 mobil"
          />
        </label>
        <PropertyFields form={form} setForm={setForm} />
        <button type="button" className={primaryBtn} disabled={busy} onClick={() => void write()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? 'Menulis…' : 'Tulis teks flyer dengan Gemini'}
        </button>
        <ErrorLine text={error} />
        <label className="block">
          <span className={label}>Judul flyer</span>
          <input className={input} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={form.title || 'Rumah siap huni'} />
        </label>
        <label className="block">
          <span className={label}>Poin unggulan (satu per baris)</span>
          <textarea className={`${input} min-h-[84px]`} value={highlights} onChange={(e) => setHighlights(e.target.value)} />
        </label>
        <label className="block">
          <span className={label}>Tombol ajakan</span>
          <input className={input} value={cta} onChange={(e) => setCta(e.target.value)} />
        </label>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(FLYER_SIZE) as FlyerFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={format === f}
              onClick={() => setFormat(f)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold cursor-pointer ${format === f ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
            >
              {FLYER_SIZE[f].label}
            </button>
          ))}
        </div>
        {preview ? (
          <>
            <div className="mt-4 flex justify-center">
              <CanvasView canvas={preview} alt="Pratinjau flyer" className={format === 'story' ? 'max-h-[640px] w-auto' : ''} />
            </div>
            <div className="mt-4 max-w-xs">
              <Slider text="Posisi foto (atas ↔ bawah)" value={focusY} onChange={setFocusY} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={primaryBtn} onClick={() => void download('feed')}>
                <Download className="h-4 w-4" /> Download Feed
              </button>
              <button type="button" className={ghostBtn} onClick={() => void download('story')}>
                <Download className="h-4 w-4" /> Download Story
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 grid aspect-square place-items-center rounded-lg bg-slate-100 text-sm text-slate-400 ring-1 ring-slate-200">
            Unggah foto properti untuk melihat flyer
          </div>
        )}
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- listing */

const ListingTool: React.FC = () => {
  const { auth } = useAdmin();
  const toast = useToast();
  const [info, setInfo] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    const { data, error: code } = await studioListingText(info, {}, auth.accessToken);
    setBusy(false);
    if (!data?.caption) return setError(aiErrorMessage(code));
    setCaption(data.caption.replace(/\\n/g, '\n'));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={card}>
        <label className="block">
          <span className={label}>Informasi properti</span>
          <textarea
            className={`${input} min-h-[360px] leading-relaxed`}
            value={info}
            onChange={(e) => setInfo(e.target.value)}
            placeholder={'Tulis bebas semua info penting, misalnya:\n\nRumah 2 lantai di Citra Gran Cibubur, posisi hook, hadap timur. LT 120, LB 150, 4 KT, 3 KM, carport 2 mobil. SHM, sudah renovasi, 5 menit ke tol. Harga 1,25 M nego.\n\nAgen: Monika Sari, WA 0812-3456-7890'}
          />
        </label>
        <button type="button" className={`${primaryBtn} mt-3`} disabled={busy || info.trim().length < 10} onClick={() => void write()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {busy ? 'Membuat listing…' : 'Buat listing dengan Gemini'}
        </button>
        <ErrorLine text={error} />
      </div>
      <div className={card}>
        <span className={label}>Hasil listing</span>
        <textarea
          className={`${input} min-h-[360px] leading-relaxed`}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Hasil listing muncul di sini dan bisa diedit."
          aria-label="Hasil listing"
        />
        <button
          type="button"
          className={`${ghostBtn} mt-3`}
          disabled={!caption}
          onClick={() => {
            void navigator.clipboard.writeText(caption).then(
              () => toast('Listing disalin.', 'success'),
              () => toast('Gagal menyalin. Salin manual dari kotak teks.', 'error')
            );
          }}
        >
          <Copy className="h-4 w-4" /> Salin
        </button>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- kompres */

const TARGETS_KB = [100, 200, 300, 500, 1000];

interface Compressed {
  name: string;
  original: number;
  blob: Blob;
  width: number;
  height: number;
  srcWidth: number;
  srcHeight: number;
  kept: boolean;
}

const CompressTool: React.FC = () => {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [targetKb, setTargetKb] = useState(300);
  const [custom, setCustom] = useState('');
  const [results, setResults] = useState<Compressed[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const target = (Number(custom) > 0 ? Number(custom) : targetKb) * 1024;

  const run = async () => {
    setError(null);
    setResults([]);
    const out: Compressed[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBusy(`Mengompres ${i + 1}/${files.length}…`);
        await nextFrame();
        const base = slugName(f.name.replace(/\.[^.]+$/, ''), 'foto');
        const canvas = await fileToCanvas(f, 8000);
        if (f.size <= target && /jpe?g$/i.test(f.type)) {
          // Sudah di bawah target: pakai file asli tanpa diubah.
          out.push({ name: `${base}.jpg`, original: f.size, blob: f, width: canvas.width, height: canvas.height, srcWidth: canvas.width, srcHeight: canvas.height, kept: true });
          continue;
        }
        const r = await compressToTarget(target, async (scale, quality) => {
          const c = scale >= 1 ? canvas : scaleCanvas(canvas, scale);
          return { blob: await canvasToBlob(c, 'image/jpeg', quality), width: c.width, height: c.height };
        });
        out.push({ name: `${base}-${Math.round(r.blob.size / 1024)}kb.jpg`, original: f.size, blob: r.blob, width: r.width, height: r.height, srcWidth: canvas.width, srcHeight: canvas.height, kept: false });
      }
      setResults(out);
    } catch (e) {
      setError((e as Error).message || 'Gagal mengompres foto.');
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    if (results.length === 1) return downloadBlob(results[0].blob, results[0].name);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      for (const r of results) zip.file(r.name, r.blob);
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'foto-kompres.zip');
    } catch {
      toast('Gagal membuat ZIP.', 'error');
    }
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-2">
        <PhotoButton
          text={files.length ? 'Ganti foto' : 'Unggah foto (bisa banyak)'}
          multiple
          primary={!files.length}
          onFiles={(fs) => {
            setFiles(fs.slice(0, 30));
            setResults([]);
          }}
        />
        {files.length > 0 && (
          <span className="text-sm text-slate-600">
            {files.length} foto · total {formatBytes(files.reduce((a, f) => a + f.size, 0))}
          </span>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-5 flex flex-wrap items-end gap-4">
          <fieldset>
            <legend className={label}>Ukuran file maksimal per foto</legend>
            <div className="flex flex-wrap gap-2">
              {TARGETS_KB.map((kb) => (
                <button
                  key={kb}
                  type="button"
                  aria-pressed={!custom && targetKb === kb}
                  onClick={() => {
                    setTargetKb(kb);
                    setCustom('');
                  }}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold cursor-pointer ${
                    !custom && targetKb === kb ? 'bg-slate-950 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  {kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block w-36">
            <span className={label}>Atau isi sendiri (KB)</span>
            <input className={input} inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, ''))} placeholder="mis. 250" />
          </label>
          <button type="button" className={primaryBtn} disabled={busy !== null} onClick={() => void run()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minimize2 className="h-4 w-4" />} {busy ?? 'Kompres'}
          </button>
        </div>
      )}
      <ErrorLine text={error} />

      {results.length > 0 && (
        <>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Foto</th>
                  <th className="py-2 pr-3 font-semibold text-right">Sebelum</th>
                  <th className="py-2 pr-3 font-semibold text-right">Sesudah</th>
                  <th className="py-2 pr-3 font-semibold">Resolusi</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.name} className="border-b border-slate-100">
                    <td className="py-2 pr-3 font-medium text-slate-800">{r.name}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-slate-500">{formatBytes(r.original)}</td>
                    <td className="py-2 pr-3 text-right font-semibold tabular-nums text-emerald-700">{formatBytes(r.blob.size)}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {r.kept
                        ? 'Asli (sudah di bawah target)'
                        : r.width === r.srcWidth
                          ? `${r.width}×${r.height} (tetap)`
                          : `${r.srcWidth}×${r.srcHeight} → ${r.width}×${r.height}`}
                    </td>
                    <td className="py-2 text-right">
                      <button type="button" className="font-semibold text-amber-700 hover:underline cursor-pointer" onClick={() => downloadBlob(r.blob, r.name)}>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className={`${primaryBtn} mt-4`} onClick={() => void downloadAll()}>
            <Download className="h-4 w-4" /> {results.length > 1 ? `Download ${results.length} foto (ZIP)` : 'Download'}
          </button>
        </>
      )}
    </div>
  );
};
