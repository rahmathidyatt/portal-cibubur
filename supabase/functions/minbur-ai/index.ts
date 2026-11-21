// Edge function "minbur-ai" (bot Epigram): jembatan portal → Gemini.
// Kunci Gemini disimpan sebagai secret GEMINI_API_KEY di Supabase (tidak pernah di GitHub/browser).
//   mode "chat"      : jawab pertanyaan Epigram berdasarkan data portal, lalu catat untuk ditinjau admin
//   mode "translate" : terjemahkan teks portal ID → EN (hasil disimpan di cache content_translations)
//   mode "wish"      : buat ucapan ulang tahun ID & EN (khusus admin)
//   mode "nota"      : baca foto nota medpro + posisi tiap baris (khusus admin)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const CHAT_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';
const TRANSLATE_MODEL = Deno.env.get('GEMINI_TRANSLATE_MODEL') ?? 'gemini-flash-lite-latest';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Satu percobaan panggilan Gemini (disimpan ke ai_usage_log untuk analisis admin). */
interface LogRow {
  mode: string;
  model: string;
  status: 'ok' | 'busy' | 'rate_limit' | 'timeout' | 'error';
  http_status: number | null;
  duration_ms: number;
  fallback: boolean;
  question?: string | null;
}

interface CallLog {
  mode: string;
  rows: LogRow[];
}

function statusOf(code: number | null): LogRow['status'] {
  if (code === null) return 'ok';
  if (code === 429) return 'rate_limit';
  if (code === 504) return 'timeout';
  if (code === 500 || code === 503) return 'busy';
  return 'error';
}

class GeminiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callGemini(
  model: string,
  system: string,
  parts: Record<string, unknown>[],
  maxTokens: number,
  thinking: 'low' | 'minimal' | null,
  timeoutMs: number,
  log: CallLog,
  fallback: boolean
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  let code: number | null = null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          maxOutputTokens: maxTokens,
          ...(thinking ? { thinkingConfig: { thinkingLevel: thinking } } : {})
        }
      })
    });
    if (!res.ok) {
      code = res.status;
      throw new GeminiError(res.status, (await res.text()).slice(0, 300));
    }
    const data = await res.json();
    const out: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
    const text = out
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, '');
    return JSON.parse(text);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      code = 504;
      throw new GeminiError(504, 'timeout');
    }
    if (code === null) code = 0;
    throw err;
  } finally {
    clearTimeout(timer);
    // Percobaan ulang tanpa pengaturan thinking (400) tidak dihitung terpisah.
    if (!(code === 400 && thinking)) {
      log.rows.push({
        mode: log.mode,
        model,
        status: statusOf(code),
        http_status: code,
        duration_ms: Date.now() - started,
        fallback,
        question: null
      });
    }
  }
}

/**
 * Panggil Gemini dengan "berpikir" seminimal mungkin agar cepat. Bila model sibuk (503/429)
 * atau terlalu lama, coba sekali lagi dengan model cadangan yang lebih ringan.
 */
async function gemini(
  model: string,
  system: string,
  user: string | Record<string, unknown>[],
  maxTokens: number,
  log: CallLog,
  timeoutMs = 25_000
): Promise<unknown> {
  const parts = typeof user === 'string' ? [{ text: user }] : user;
  const attempt = async (m: string, ms: number, fallback: boolean) => {
    const level = /lite/.test(m) ? 'minimal' : 'low';
    try {
      return await callGemini(m, system, parts, maxTokens, level, ms, log, fallback);
    } catch (err) {
      // Model tidak mendukung pengaturan thinking: ulangi tanpa pengaturan itu.
      if (err instanceof GeminiError && err.status === 400 && /thinking/i.test(err.message))
        return await callGemini(m, system, parts, maxTokens, null, ms, log, fallback);
      throw err;
    }
  };
  try {
    return await attempt(model, timeoutMs, false);
  } catch (err) {
    const busy = err instanceof GeminiError && [429, 500, 503, 504].includes(err.status);
    if (!busy || model === TRANSLATE_MODEL) throw err;
    console.error('gemini sibuk, pakai model cadangan', (err as GeminiError).status);
    return await attempt(TRANSLATE_MODEL, timeoutMs, true);
  }
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined)
    }
  });
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ---------------------------------------------------------------- chat */

const CHAT_SYSTEM = (lang: 'id' | 'en') => `Kamu adalah Epigram, asisten chat di portal Brighton HUB Cibubur — kantor Brighton Real Estate di Centrum Cibubur. Penanya umumnya agen properti Brighton.

Aturan:
1. Topik yang boleh dijawab HANYA: (a) seputar kantor Brighton HUB Cibubur, (b) dunia real estate/properti (jual-beli, sewa, KPR, sertifikat SHM/HGB/AJB, pajak properti, tips agen properti). Pertanyaan di luar itu: tolak dengan sopan dalam 1 kalimat dan arahkan kembali ke topik kantor/properti.
2. Fakta tentang kantor (jadwal floor time, jam, kontak, nama BM, pengumuman, ulang tahun, link) WAJIB diambil dari DATA PORTAL di bawah. Jangan mengarang nama, nomor, tanggal, atau jadwal. Bila datanya tidak ada, katakan belum tahu dan sarankan menghubungi tim operasional.
3. Penanya sering mengetik singkat, salah ketik, singkatan, atau bahkan 1–2 huruf. Tebak maksud yang paling mungkin dari DATA PORTAL dan langsung jawab. Bila masih benar-benar ambigu, ajukan 1 pertanyaan balik singkat dengan 2–3 pilihan (mis. "Maksudnya Floor Time, Jam kantor, atau Kontak staf?").
4. Untuk pengetahuan umum properti, jawab ringkas dan praktis; sebutkan bahwa detail resmi sebaiknya dicek ke notaris/bank/BM bila menyangkut angka atau hukum.
5. Jawab dalam ${lang === 'en' ? 'bahasa Inggris' : 'bahasa Indonesia'} yang ramah dan profesional, teks biasa tanpa markdown, maksimal sekitar 5 kalimat. Boleh memakai baris baru untuk daftar singkat.

Keluarkan JSON: {"answer": "<jawaban>"}`;

async function handleChat(body: Record<string, unknown>, log: CallLog): Promise<Response> {
  const question = String(body.question ?? '').trim().slice(0, 300);
  const context = String(body.context ?? '').slice(0, 20000);
  const lang = body.lang === 'en' ? 'en' : 'id';
  if (!question) return json({ error: 'empty' }, 400);
  const out = (await gemini(
    CHAT_MODEL,
    CHAT_SYSTEM(lang),
    `DATA PORTAL:\n${context}\n\nPERTANYAAN AGEN:\n${question}`,
    800,
    log
  )) as { answer?: string };
  const answer = String(out?.answer ?? '').trim().slice(0, 1500);
  if (!answer) return json({ error: 'no_answer' }, 502);
  // Catat agar admin bisa meninjau & menjadikannya FAQ resmi.
  await rest('rpc/record_minbur_ai_answer', {
    method: 'POST',
    body: JSON.stringify({ p_question: question.slice(0, 200), p_answer: answer })
  }).catch(() => undefined);
  return json({ answer });
}

/* ----------------------------------------------------------- translate */

const TRANSLATE_SYSTEM = `Terjemahkan setiap teks dari bahasa Indonesia ke bahasa Inggris yang natural untuk portal kantor real estate (Brighton HUB Cibubur).
- Pertahankan nama orang, kode agen (huruf kapital seperti MHBX), nama tempat, nama unit (mis. Brighton Warrior), angka, jam, URL, emoji, dan spasi di awal/akhir teks.
- Istilah yang sudah lazim dibiarkan: floor time, closing, Business Manager, Co-Broking, Bright Day, WOF, listing.
- Bila teks sudah berbahasa Inggris atau tidak perlu diterjemahkan, kembalikan apa adanya.
- Jumlah dan urutan hasil HARUS sama dengan input.
Keluarkan JSON: {"t": ["<terjemahan 1>", "<terjemahan 2>", ...]}`;

async function handleTranslate(body: Record<string, unknown>, log: CallLog): Promise<Response> {
  const texts = (Array.isArray(body.texts) ? body.texts : []).slice(0, 80).map((t) => String(t ?? '').slice(0, 2000));
  if (texts.length === 0) return json({ texts: [] });
  const hashes = await Promise.all(texts.map((t) => sha256(t)));
  const result: (string | null)[] = texts.map(() => null);

  const cacheRes = await rest(
    `content_translations?select=hash,translated&lang=eq.en&hash=in.(${[...new Set(hashes)].join(',')})`
  );
  const cached = new Map<string, string>();
  if (cacheRes.ok) for (const r of (await cacheRes.json()) as { hash: string; translated: string }[]) cached.set(r.hash, r.translated);
  hashes.forEach((h, i) => {
    if (cached.has(h)) result[i] = cached.get(h)!;
  });

  const missingIdx = [...new Set(hashes.map((h, i) => (cached.has(h) ? -1 : hashes.indexOf(h))).filter((i) => i >= 0))];
  if (missingIdx.length > 0) {
    const out = (await gemini(
      TRANSLATE_MODEL,
      TRANSLATE_SYSTEM,
      JSON.stringify(missingIdx.map((i) => texts[i])),
      8000,
      log
    )) as { t?: unknown[] };
    const translated = Array.isArray(out?.t) ? out.t : [];
    if (translated.length === missingIdx.length) {
      const rows: { hash: string; lang: string; source: string; translated: string }[] = [];
      missingIdx.forEach((i, k) => {
        const t = String(translated[k] ?? '').slice(0, 4000);
        if (!t) return;
        rows.push({ hash: hashes[i], lang: 'en', source: texts[i], translated: t });
        hashes.forEach((h, j) => {
          if (h === hashes[i]) result[j] = t;
        });
      });
      if (rows.length > 0) {
        await rest('content_translations?on_conflict=hash,lang', {
          method: 'POST',
          headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(rows)
        }).catch(() => undefined);
      }
    }
  }
  return json({ texts: result });
}

/* ---------------------------------------------------------------- wish */

async function isAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_portal_admin`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, Authorization: auth, 'Content-Type': 'application/json' },
    body: '{}'
  });
  return res.ok && (await res.json()) === true;
}

const WISH_SYSTEM = `Buat SATU kalimat ucapan ulang tahun yang hangat dan profesional untuk agen properti di kantor Brighton Real Estate (Brighton HUB Cibubur). Jangan sebut nama orang, tanpa emoji, maksimal 30 kata. Contoh gaya: "May each passing year bring greater wisdom, higher achievements, and more meaningful happiness." Buat variasi baru, jangan mengulang contoh.
Keluarkan JSON: {"en": "<kalimat bahasa Inggris>", "id": "<padanan bahasa Indonesia yang natural>"}`;

async function handleWish(req: Request, log: CallLog): Promise<Response> {
  if (!(await isAdmin(req))) return json({ error: 'forbidden' }, 403);
  const out = (await gemini(CHAT_MODEL, WISH_SYSTEM, `Variasi #${crypto.randomUUID().slice(0, 8)}`, 400, log)) as {
    en?: string;
    id?: string;
  };
  const en = String(out?.en ?? '').trim().slice(0, 300);
  const id = String(out?.id ?? '').trim().slice(0, 300);
  if (!en || !id) return json({ error: 'no_answer' }, 502);
  return json({ en, id });
}

/* ---------------------------------------------------------------- nota */

const NOTA_SYSTEM = `You read a photo of an Indonesian printing invoice ("FAKTUR PENJUALAN") for Brighton office media promotion (banners, ID cards, business cards, etc.).
Return JSON only:
{
  "invoice": full invoice number exactly as printed after "Nomor", e.g. "022642/ASP/FP/XI/2026",
  "date": invoice date as YYYY-MM-DD (from the city/date line near the bottom, e.g. "Depok, 13 November 2026"),
  "paper_box_2d": [ymin, xmin, ymax, xmax] of the whole invoice paper,
  "items": one object per printed item row (ignore empty rows with "-"), in order:
    {
      "description": full text of the "Judul Buku" cell,
      "product": product type, e.g. "BANNER", "STIKER BANNER", "ID CARD", "KARTU NAMA", "PROMO",
      "label": the customer/listing name and purpose after the product word and before "ukuran", e.g. "MONIKA JUAL", "HENDRA & NING JUAL SEWA",
      "size": size text after "ukuran" as printed, e.g. "0,8 x 0,5 m" ("" if none),
      "price": integer rupiah (16.000 -> 16000), "qty": integer, "total": integer rupiah,
      "box_2d": [ymin, xmin, ymax, xmax] tightly around the "Judul Buku" text of this row only
    },
  "total_qty": integer under "Jumlah" qty column, "grand_total": integer rupiah total at the bottom
}
All box coordinates are normalized 0-1000 relative to the full image. Copy names exactly as printed (keep typos). Never invent rows.`;

async function handleNota(req: Request, body: Record<string, unknown>, log: CallLog): Promise<Response> {
  if (!(await isAdmin(req))) return json({ error: 'forbidden' }, 403);
  const image = String(body.image ?? '');
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m || m[2].length > 8_000_000) return json({ error: 'image' }, 400);
  const out = await gemini(
    CHAT_MODEL,
    NOTA_SYSTEM,
    [{ inline_data: { mime_type: m[1], data: m[2] } }, { text: 'Read this invoice.' }],
    8000,
    log,
    60_000
  );
  return json(out);
}

/* -------------------------------------------------------------- server */

/** Simpan catatan pemakaian (gagal menyimpan tidak mengganggu jawaban). */
async function flushLog(log: CallLog, question: string | null): Promise<void> {
  if (log.rows.length === 0) return;
  if (question) log.rows[0].question = question.slice(0, 200);
  await rest('ai_usage_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(log.rows) }).catch(
    () => undefined
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!GEMINI_KEY) return json({ error: 'not_configured' }, 503);
  let body: Record<string, unknown> = {};
  const log: CallLog = { mode: 'unknown', rows: [] };
  try {
    body = (await req.json()) as Record<string, unknown>;
    log.mode = String(body.mode ?? 'unknown').slice(0, 20);
    switch (body.mode) {
      case 'chat':
        return await handleChat(body, log);
      case 'translate':
        return await handleTranslate(body, log);
      case 'wish':
        return await handleWish(req, log);
      case 'nota':
        return await handleNota(req, body, log);
      default:
        return json({ error: 'mode' }, 400);
    }
  } catch (err) {
    console.error(err);
    const busy = err instanceof GeminiError && [429, 500, 503, 504].includes(err.status);
    return json({ error: busy ? 'busy' : 'failed' }, busy ? 503 : 502);
  } finally {
    await flushLog(log, body.mode === 'chat' ? String(body.question ?? '').trim() : null);
  }
});
