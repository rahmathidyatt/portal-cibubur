import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, MessageCircle, Send, X } from 'lucide-react';
import { OFFICE_IDENTITY, OFFICE_STAFF_CONTACTS, WEEKLY_OFFICE_HOURS } from '../../data/cibuburData';
import { getScheduleStore } from '../floortime/scheduleStore';
import type { ScheduleData } from '../floortime/engine';
import { readMyAgentCode, saveMyAgentCode } from '../floortime/mySchedule';
import { getContentStore } from '../../services/contentStore';
import { getBirthdayStore } from '../../services/birthdayStore';
import { getMinburStore, MINBUR_FAQ_CHANGED, type MinburFaq } from '../../services/minburStore';
import { addDaysIso } from '../birthdays/birthdays';
import { todayInJakarta } from '../../utils/schedule';
import { askGemini } from '../../services/aiClient';
import { useLang } from '../../i18n/lang';
import {
  NAVIGATION_ANSWER,
  QUICK_QUESTIONS,
  answerAnniversary,
  answerAnnouncements,
  answerBirthdays,
  answerBusinessManagers,
  answerFromTaught,
  answerHolidays,
  matchTaughtFaq,
  answerFloorToday,
  answerHours,
  answerMySchedule,
  contactLine,
  detectIntent,
  findAgentCode,
  waLink,
  type MinburAnswer
} from './minburFaq';

interface ChatMessage {
  id: number;
  from: 'user' | 'minbur';
  lines: string[];
  /** Diketik sendiri oleh pengunjung (tidak diterjemahkan). */
  typed?: boolean;
  links?: MinburAnswer['links'];
  /** Jawaban Gemini sudah dalam bahasa pilihan, jadi tidak diterjemahkan lagi. */
  ai?: boolean;
}

type Reply = MinburAnswer & { ai?: boolean };

const ops = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'OPERASIONAL') ?? OFFICE_STAFF_CONTACTS[0];

const WELCOME: ChatMessage = {
  id: 0,
  from: 'minbur',
  lines: [
    'Halo! Saya Epigram, asisten Brighton HUB Cibubur 👋',
    'Tanya apa saja seputar kantor: floor time, jam kantor, Business Manager, ulang tahun, pengumuman, order messenger, kontak staf, dan lainnya. Pilih pertanyaan di bawah atau ketik saja.'
  ]
};

const Avatar: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span
    aria-hidden="true"
    className={`grid shrink-0 place-items-center rounded-full bg-amber-400 font-black text-slate-950 ${
      size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs'
    }`}
  >
    E
  </span>
);

/** Pop-up chat "Epigram" (asisten Brighton HUB Cibubur): bot FAQ yang menjawab dari data portal. */
/** aboveJingle: tombol chat berada di atas tombol jingle (saat admin login). */
export const Minbur: React.FC<{ aboveJingle?: boolean }> = ({ aboveJingle = false }) => {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const schedulesRef = useRef<Map<string, Promise<ScheduleData | null>>>(new Map());
  const faqRef = useRef<Promise<MinburFaq[]> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    // Di HP keyboard tidak langsung muncul agar agen bisa membaca dulu.
    if (open && window.matchMedia('(min-width: 640px)').matches) inputRef.current?.focus();
    document.documentElement.classList.toggle('minbur-open', open);
    return () => document.documentElement.classList.remove('minbur-open');
  }, [open]);

  useEffect(() => {
    const reset = () => {
      faqRef.current = null;
    };
    window.addEventListener(MINBUR_FAQ_CHANGED, reset);
    return () => window.removeEventListener(MINBUR_FAQ_CHANGED, reset);
  }, []);

  const loadSchedule = (iso: string): Promise<ScheduleData | null> => {
    const key = iso.slice(0, 7);
    let p = schedulesRef.current.get(key);
    if (!p) {
      const [y, m] = key.split('-').map(Number);
      p = getScheduleStore()
        .getSchedule(y, m)
        .then((s) => s?.data ?? null)
        .catch(() => null);
      schedulesRef.current.set(key, p);
    }
    return p;
  };

  const loadFaq = (): Promise<MinburFaq[]> => {
    if (!faqRef.current) {
      faqRef.current = getMinburStore()
        .listFaq()
        .catch(() => []);
    }
    return faqRef.current;
  };

  /** Ringkasan data portal yang dikirim ke Gemini sebagai satu-satunya sumber jawaban. */
  const buildContext = async (today: string, now: Date): Promise<string> => {
    const tomorrow = addDaysIso(today, 1);
    const [faqs, data, dataTomorrow, anns, bms, bdays] = await Promise.all([
      loadFaq(),
      loadSchedule(today),
      loadSchedule(tomorrow),
      getContentStore().listAnnouncements().catch(() => []),
      getContentStore().listBusinessManagers().catch(() => []),
      getBirthdayStore().list().catch(() => [])
    ]);
    const block = (title: string, a: MinburAnswer | string[]) =>
      `## ${title}\n${(Array.isArray(a) ? a : a.lines).join('\n')}`;
    return [
      block('Kantor', [
        OFFICE_IDENTITY.name,
        `Alamat: ${OFFICE_IDENTITY.address}`,
        `Telepon: ${OFFICE_IDENTITY.phoneDisplay}`,
        `Google Maps: ${OFFICE_IDENTITY.mapsUrl}`,
        `Order Smart Messenger: ${OFFICE_IDENTITY.smartMessengerOrderUrl}`,
        `Tanggal hari ini: ${today}`
      ]),
      block('Jam kantor', answerHours(WEEKLY_OFFICE_HOURS, now)),
      block('Kontak staf', OFFICE_STAFF_CONTACTS.map((c) => contactLine(c))),
      block('Floor time hari ini', answerFloorToday(data, today)),
      block('Floor time besok', answerFloorToday(dataTomorrow, tomorrow, 'besok')),
      block('Libur', answerHolidays(data, today, WEEKLY_OFFICE_HOURS)),
      block('Pengumuman', answerAnnouncements(anns, today)),
      block('Business Manager', answerBusinessManagers(bms, 'business manager')),
      block('Ulang tahun agen', answerBirthdays(bdays, today)),
      block('Usia kantor', answerAnniversary(OFFICE_IDENTITY.foundedDate, today)),
      block('Cara pakai portal', NAVIGATION_ANSWER),
      block(
        'FAQ resmi dari admin',
        faqs.map((f) => `- Kata kunci: ${f.keywords}\n  Jawaban: ${f.answer}${f.linkUrl ? ` (${f.linkUrl})` : ''}`)
      )
    ].join('\n\n');
  };

  const answer = async (text: string): Promise<Reply> => {
    const now = new Date();
    const today = todayInJakarta(now);
    // 1) Jawaban yang diajarkan admin lebih diutamakan.
    const taught = matchTaughtFaq(text, await loadFaq());
    if (taught) return answerFromTaught(taught);

    const intent = detectIntent(text);

    // Kode agen di pertanyaan (mis. "ADOL") langsung dianggap tanya jadwal.
    const needsSchedule = intent === null || intent === 'floortime-saya' || intent === 'floortime-hari-ini' || intent === 'libur';
    const data = needsSchedule ? await loadSchedule(today) : null;
    const code = data ? findAgentCode(text, data.agents.map((a) => a.code)) : null;
    if (code && (intent === null || intent === 'floortime-saya')) {
      saveMyAgentCode(code);
      return answerMySchedule(data, code, today);
    }

    switch (intent) {
      case 'salam':
        return { lines: ['Halo! Ada yang bisa Epigram bantu? Coba pilih salah satu pertanyaan di bawah.'] };
      case 'terima-kasih':
        return { lines: ['Sama-sama! Semoga lancar closing-nya 🙌'] };
      case 'tentang':
        return {
          lines: [
            'Saya Epigram, asisten chat Brighton HUB Cibubur.',
            'Saya menjawab pertanyaan umum dari data portal: floor time, jam kantor, pengumuman, order messenger, dan kontak staf. Untuk hal lain, langsung hubungi tim operasional ya.'
          ],
          links: [{ label: `WhatsApp Operasional`, href: waLink(ops), external: true }]
        };
      case 'jam':
        return answerHours(WEEKLY_OFFICE_HOURS, now);
      case 'lokasi':
        return {
          lines: [`${OFFICE_IDENTITY.name}`, OFFICE_IDENTITY.address, `Telepon kantor: ${OFFICE_IDENTITY.phoneDisplay}`],
          links: [
            { label: 'Buka Google Maps', href: OFFICE_IDENTITY.mapsUrl, external: true },
            { label: 'Telepon kantor', href: OFFICE_IDENTITY.phoneHref }
          ]
        };
      case 'floortime-hari-ini':
        return answerFloorToday(data, today);
      case 'floortime-besok': {
        const tomorrow = addDaysIso(today, 1);
        return answerFloorToday(await loadSchedule(tomorrow), tomorrow, 'besok');
      }
      case 'libur':
        return answerHolidays(data, today, WEEKLY_OFFICE_HOURS);
      case 'bm': {
        const list = await getContentStore()
          .listBusinessManagers()
          .catch(() => []);
        return answerBusinessManagers(list, text);
      }
      case 'ulang-tahun': {
        const list = await getBirthdayStore()
          .list()
          .catch(() => []);
        return answerBirthdays(list, today);
      }
      case 'usia-kantor':
        return answerAnniversary(OFFICE_IDENTITY.foundedDate, today);
      case 'navigasi':
        return NAVIGATION_ANSWER;
      case 'floortime-saya':
        return answerMySchedule(data, readMyAgentCode(), today);
      case 'floortime-tukar':
        return {
          lines: [
            'Untuk pindah atau tukar jadwal floor time, ajukan lewat formulir request di halaman Floor Time.',
            'Buka jadwal Anda di "Jadwal saya", lalu klik Pindah pada tanggal yang ingin diubah — formulirnya terisi otomatis. Admin akan memproses request Anda.'
          ],
          links: [{ label: 'Buka halaman Floor Time', href: '#floortime' }]
        };
      case 'messenger': {
        const courier = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'MESSENGER');
        return {
          lines: [
            'Untuk kebutuhan messenger (antar/jemput dokumen, pasang banner, dll.), isi formulir Order Smart Messenger.',
            ...(courier ? [`Butuh konfirmasi cepat? ${contactLine(courier)}`] : [])
          ],
          links: [
            { label: 'Order Smart Messenger', href: OFFICE_IDENTITY.smartMessengerOrderUrl, external: true },
            ...(courier ? [{ label: 'WhatsApp Messenger', href: waLink(courier), external: true }] : [])
          ]
        };
      }
      case 'pengumuman': {
        const list = await getContentStore()
          .listAnnouncements()
          .catch(() => []);
        return answerAnnouncements(list, today);
      }
      case 'kontak': {
        const t = text.toLowerCase();
        const pick = /financ|keuangan|invoice|komisi|bayar/.test(t)
          ? 'FINANCE'
          : /messenger|kurir/.test(t)
            ? 'MESSENGER'
            : /operasional|admin|\bops\b/.test(t)
              ? 'OPERASIONAL'
              : null;
        const contacts = pick ? OFFICE_STAFF_CONTACTS.filter((c) => c.division === pick) : OFFICE_STAFF_CONTACTS;
        return {
          lines: ['Kontak staf Brighton HUB Cibubur:', ...contacts.map((c) => `• ${contactLine(c)}`)],
          links: contacts.map((c) => ({
            label: `WhatsApp ${c.staffName.split(' (')[0].split(' ')[0]}`,
            href: waLink(c),
            external: true
          }))
        };
      }
      default: {
        // 2) Tidak ketemu di FAQ → tanya Gemini dengan data portal sebagai acuan.
        const ai = await askGemini(text, await buildContext(today, now), lang);
        if (ai) {
          return {
            lines: ai.split(/\n+/).filter((l) => l.trim()),
            links: [{ label: 'WhatsApp Operasional', href: waLink(ops), external: true }],
            ai: true
          };
        }
        void getMinburStore()
          .recordUnanswered(text)
          .catch(() => undefined);
        return {
          lines: [
            'Maaf, Epigram belum paham pertanyaan itu 🙏',
            'Pertanyaan ini sudah Epigram catat supaya admin bisa mengajarkan jawabannya. Sementara itu, silakan hubungi tim operasional.'
          ],
          links: [{ label: 'WhatsApp Operasional', href: waLink(ops), external: true }]
        };
      }
    }
  };

  const ask = async (text: string, typed = true) => {
    const q = text.trim();
    if (!q || typing) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId.current++, from: 'user', lines: [q], typed }]);
    setTyping(true);
    const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 450))]);
    setTyping(false);
    setMessages((m) => [...m, { id: nextId.current++, from: 'minbur', ...reply }]);
  };

  return (
    <div
      className={`fixed left-3 z-40 sm:left-4 ${aboveJingle ? 'bottom-[4.25rem] sm:bottom-[4.5rem]' : 'bottom-3 sm:bottom-4'}`}
    >
      {open && (
        <div
          role="dialog"
          aria-label="Chat Epigram"
          className="fixed inset-0 z-50 flex h-[100dvh] w-full flex-col overflow-hidden bg-stone-50 sm:static sm:z-auto sm:mb-3 sm:h-[min(560px,calc(100dvh-12rem))] sm:w-[360px] sm:rounded-2xl sm:bg-white/60 sm:shadow-2xl sm:ring-1 sm:ring-white/60 sm:backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 bg-slate-950 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white sm:bg-slate-950/80 sm:backdrop-blur">
            <Avatar size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Epigram</p>
              <p className="text-[11px] text-slate-400">Asisten Brighton HUB Cibubur</p>
            </div>
            <button
              type="button"
              aria-label="Tutup chat"
              onClick={() => setOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white sm:h-8 sm:w-8"
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {messages.map((msg) =>
              msg.from === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <p
                    translate={msg.typed ? 'no' : undefined}
                    className={`${msg.typed ? 'notranslate ' : ''}max-w-[80%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-slate-950 px-3 py-2 text-[15px] text-white sm:text-sm`}
                  >
                    {msg.lines[0]}
                  </p>
                </div>
              ) : (
                <div key={msg.id} className="flex items-end gap-2">
                  <Avatar />
                  <div
                    translate={msg.ai ? 'no' : undefined}
                    className={`${msg.ai ? 'notranslate ' : ''}max-w-[85%] break-words rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[15px] text-slate-800 shadow-sm ring-1 ring-slate-200/70 sm:bg-white/85 sm:text-sm sm:ring-white/70`}
                  >
                    {msg.lines.map((line, i) => (
                      <p key={i} className={`whitespace-pre-line ${i > 0 ? 'mt-1' : ''}`}>
                        {line}
                      </p>
                    ))}
                    {msg.links && msg.links.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.links.map((l) => (
                          <a
                            key={l.href + l.label}
                            href={l.href}
                            target={l.external ? '_blank' : undefined}
                            rel={l.external ? 'noopener noreferrer' : undefined}
                            onClick={() => !l.external && setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                          >
                            {l.label}
                            {l.external && <ExternalLink className="h-3 w-3" aria-hidden="true" />}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            {typing && (
              <div className="flex items-end gap-2">
                <Avatar />
                <p className="rounded-2xl rounded-bl-md bg-white/85 px-3 py-2 text-sm text-slate-500 ring-1 ring-white/70">
                  Epigram sedang mengetik…
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 bg-white pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:border-white/60 sm:bg-white/50 sm:pb-0">
            <div className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1 [scrollbar-width:none]">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => void ask(q.text, false)}
                  className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 text-[13px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs text-slate-700 ring-1 ring-slate-200/70 hover:bg-white"
                >
                  {q.label}
                </button>
              ))}
            </div>
            <form
              className="flex items-center gap-2 px-3 pb-3 pt-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya Epigram…"
                aria-label="Pertanyaan untuk Epigram"
                maxLength={200}
                className="min-w-0 flex-1 rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2.5 text-base outline-none focus:border-amber-500 sm:py-2 sm:text-sm"
              />
              <button
                type="submit"
                aria-label="Kirim"
                disabled={!input.trim() || typing}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400 sm:h-9 sm:w-9 text-slate-950 hover:bg-amber-500 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? 'Tutup chat Epigram' : 'Chat Epigram'}
        title="Chat Epigram"
        className={`${open ? 'hidden sm:grid' : 'grid'} h-12 w-12 place-items-center rounded-full bg-white/45 text-amber-600 ring-1 ring-slate-900/10 shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-150 transition hover:bg-white/80`}
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />}
      </button>
    </div>
  );
};
