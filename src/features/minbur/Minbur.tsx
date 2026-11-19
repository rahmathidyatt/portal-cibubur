import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, MessageCircle, Send, X } from 'lucide-react';
import { OFFICE_IDENTITY, OFFICE_STAFF_CONTACTS, WEEKLY_OFFICE_HOURS } from '../../data/cibuburData';
import { getScheduleStore } from '../floortime/scheduleStore';
import type { ScheduleData } from '../floortime/engine';
import { readMyAgentCode, saveMyAgentCode } from '../floortime/mySchedule';
import { getContentStore } from '../../services/contentStore';
import { todayInJakarta } from '../../utils/schedule';
import {
  QUICK_QUESTIONS,
  answerAnnouncements,
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
  links?: MinburAnswer['links'];
}

const ops = OFFICE_STAFF_CONTACTS.find((c) => c.division === 'OPERASIONAL') ?? OFFICE_STAFF_CONTACTS[0];

const WELCOME: ChatMessage = {
  id: 0,
  from: 'minbur',
  lines: [
    'Halo! Saya Minbur, admin Cibubur 👋',
    'Saya bisa bantu soal floor time, jam kantor, order messenger, pengumuman, dan kontak staf. Pilih pertanyaan di bawah atau ketik saja.'
  ]
};

const Avatar: React.FC<{ size?: 'sm' | 'md' }> = ({ size = 'sm' }) => (
  <span
    aria-hidden="true"
    className={`grid shrink-0 place-items-center rounded-full bg-amber-400 font-black text-slate-950 ${
      size === 'md' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs'
    }`}
  >
    M
  </span>
);

/** Pop-up chat "Minbur" (admin cibubur): bot FAQ yang menjawab dari data portal. */
export const Minbur: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scheduleRef = useRef<Promise<ScheduleData | null> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const loadSchedule = (): Promise<ScheduleData | null> => {
    if (!scheduleRef.current) {
      const [y, m] = todayInJakarta().split('-').map(Number);
      scheduleRef.current = getScheduleStore()
        .getSchedule(y, m)
        .then((s) => s?.data ?? null)
        .catch(() => null);
    }
    return scheduleRef.current;
  };

  const answer = async (text: string): Promise<MinburAnswer> => {
    const now = new Date();
    const today = todayInJakarta(now);
    const intent = detectIntent(text);

    // Kode agen di pertanyaan (mis. "ADOL") langsung dianggap tanya jadwal.
    const data = intent === null || intent === 'floortime-saya' || intent === 'floortime-hari-ini' ? await loadSchedule() : null;
    const code = data ? findAgentCode(text, data.agents.map((a) => a.code)) : null;
    if (code && (intent === null || intent === 'floortime-saya')) {
      saveMyAgentCode(code);
      return answerMySchedule(data, code, today);
    }

    switch (intent) {
      case 'salam':
        return { lines: ['Halo! Ada yang bisa Minbur bantu? Coba pilih salah satu pertanyaan di bawah.'] };
      case 'terima-kasih':
        return { lines: ['Sama-sama! Semoga lancar closing-nya 🙌'] };
      case 'tentang':
        return {
          lines: [
            'Saya Minbur, singkatan dari admin Cibubur.',
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
      default:
        return {
          lines: [
            'Maaf, Minbur belum paham pertanyaan itu 🙏',
            'Coba tanya soal floor time, jam kantor, pengumuman, order messenger, atau kontak staf. Untuk hal lain, langsung hubungi tim operasional.'
          ],
          links: [{ label: 'WhatsApp Operasional', href: waLink(ops), external: true }]
        };
    }
  };

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setInput('');
    setMessages((m) => [...m, { id: nextId.current++, from: 'user', lines: [q] }]);
    setTyping(true);
    const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 450))]);
    setTyping(false);
    setMessages((m) => [...m, { id: nextId.current++, from: 'minbur', ...reply }]);
  };

  return (
    <div className="fixed bottom-[4.25rem] left-3 z-40 sm:bottom-4 sm:left-4">
      {open && (
        <div
          role="dialog"
          aria-label="Chat Minbur"
          className="mb-3 flex h-[min(560px,calc(100dvh-10rem))] sm:h-[min(560px,calc(100dvh-6rem))] w-[min(360px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl bg-white/60 shadow-2xl ring-1 ring-white/60 backdrop-blur-xl"
        >
          <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-3 text-white backdrop-blur">
            <Avatar size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Minbur</p>
              <p className="text-[11px] text-slate-400">Admin Cibubur · bot jawab otomatis</p>
            </div>
            <button
              type="button"
              aria-label="Tutup chat"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-4" aria-live="polite">
            {messages.map((msg) =>
              msg.from === 'user' ? (
                <div key={msg.id} className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-br-md bg-slate-950 px-3 py-2 text-sm text-white">{msg.lines[0]}</p>
                </div>
              ) : (
                <div key={msg.id} className="flex items-end gap-2">
                  <Avatar />
                  <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-white/85 px-3 py-2 text-sm text-slate-800 shadow-sm ring-1 ring-white/70">
                    {msg.lines.map((line, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : ''}>
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
                  Minbur sedang mengetik…
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-white/60 bg-white/50">
            <div className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 pb-1 [scrollbar-width:none]">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => void ask(q.text)}
                  className="shrink-0 rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-white"
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
                placeholder="Tanya Minbur…"
                aria-label="Pertanyaan untuk Minbur"
                maxLength={200}
                className="min-w-0 flex-1 rounded-xl border border-slate-300/70 bg-white/80 px-3 py-2 text-sm outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                aria-label="Kirim"
                disabled={!input.trim() || typing}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-500 disabled:opacity-40"
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
        aria-label={open ? 'Tutup chat Minbur' : 'Chat Minbur'}
        title="Chat Minbur"
        className="grid h-12 w-12 place-items-center rounded-full bg-white/50 text-slate-900 shadow-lg ring-1 ring-white/70 backdrop-blur-xl transition hover:bg-white/80"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <MessageCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />}
      </button>
    </div>
  );
};
