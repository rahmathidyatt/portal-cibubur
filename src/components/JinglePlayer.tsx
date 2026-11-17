import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Disc3, ListMusic, Minus, Pause, Play, SkipForward } from 'lucide-react';
import { resolveJingleUrl, type Jingle } from '../data/jingles';
import { getJingleStore, JINGLES_CHANGED_EVENT } from '../services/jingleStore';

function baseUrl(): string {
  const env: Partial<ImportMetaEnv> = import.meta.env ?? {};
  return env.BASE_URL ?? '';
}

const PAUSED_KEY = 'portal-cibubur:jingle-paused';
const MINI_KEY = 'portal-cibubur:jingle-mini';
const VOLUME = 0.3;

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, on: boolean): void {
  try {
    if (on) window.localStorage.setItem(key, '1');
    else window.localStorage.removeItem(key);
  } catch {
    // diabaikan
  }
}

/** Jeda yang dipilih pengunjung diingat seterusnya di perangkat ini. */
const rememberPaused = (paused: boolean) => writeFlag(PAUSED_KEY, paused);

/** HP/tablet: jangan memutar otomatis (hemat kuota & tidak mengagetkan). */
function isTouchDevice(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
  } catch {
    return false;
  }
}

/**
 * Pemutar jingle Brighton: di komputer langsung memutar (volume pelan) saat
 * portal dibuka dan lanjut bergantian. Bila browser menahan autoplay, lagu
 * mulai pada sentuhan/klik/tombol pertama. Di HP/tablet tidak diputar otomatis.
 * Jeda dan mode ringkas diingat di perangkat ini.
 */
export const JinglePlayer: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [tracks, setTracks] = useState<Jingle[]>([]);
  const [index, setIndex] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [waiting, setWaiting] = useState<boolean>(false);
  const [listOpen, setListOpen] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  // Tidak diputar otomatis bila pernah dijeda, atau di HP/tablet.
  const userPaused = useRef<boolean>(readFlag(PAUSED_KEY) || isTouchDevice());
  const [mini, setMini] = useState<boolean>(() => readFlag(MINI_KEY));
  const setMiniMode = (on: boolean) => {
    setMini(on);
    writeFlag(MINI_KEY, on);
  };

  const load = useCallback(async () => {
    try {
      const list = await getJingleStore().list();
      setTracks((prev) => {
        if (prev.length === 0 && list.length > 0) setIndex(Math.floor(Math.random() * list.length));
        return list;
      });
    } catch {
      setTracks([]);
    }
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(JINGLES_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(JINGLES_CHANGED_EVENT, onChange);
  }, [load]);

  const safeIndex = tracks.length ? index % tracks.length : 0;
  const current = tracks[safeIndex];

  const tryPlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !audio.src) return;
    try {
      await audio.play();
      setWaiting(false);
    } catch {
      setWaiting(true);
    }
  }, []);

  // Ganti lagu: muat sumber baru lalu putar bila sedang/akan diputar.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    audio.src = resolveJingleUrl(current.url, baseUrl());
    audio.volume = VOLUME;
    setProgress(0);
    if (!userPaused.current) void tryPlay();
  }, [current, tryPlay]);

  // Autoplay diblokir: mulai pada interaksi pertama di luar pemutar.
  useEffect(() => {
    if (!waiting) return;
    const start = (e: Event) => {
      if (userPaused.current) return;
      if (rootRef.current && e.target instanceof Node && rootRef.current.contains(e.target)) return;
      void tryPlay();
    };
    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'click'] as const;
    for (const ev of events) document.addEventListener(ev, start, true);
    return () => {
      for (const ev of events) document.removeEventListener(ev, start, true);
    };
  }, [waiting, tryPlay]);

  if (!current) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      userPaused.current = true;
      rememberPaused(true);
      audio.pause();
    } else {
      userPaused.current = false;
      rememberPaused(false);
      void tryPlay();
    }
  };

  const next = () => setIndex((i) => (i + 1) % Math.max(1, tracks.length));
  const choose = (i: number) => {
    userPaused.current = false;
    rememberPaused(false);
    setIndex(i);
    setListOpen(false);
    if (i === safeIndex) void tryPlay();
  };

  const glass =
    'bg-white/45 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-slate-900/10 shadow-[0_8px_30px_rgba(15,23,42,0.12)]';
  const iconBtn =
    'grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-600 hover:bg-slate-900/5 hover:text-slate-950 cursor-pointer';

  return (
    <div ref={rootRef} className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 max-w-[calc(100vw-1.5rem)]">
      <audio
        ref={audioRef}
        preload="none"
        loop={tracks.length === 1}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={next}
        onError={() => tracks.length > 1 && next()}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          setProgress(a.duration ? a.currentTime / a.duration : 0);
        }}
      />

      {listOpen && !mini && (
        <div id="jingle-list" className={`mb-2 w-60 max-w-full overflow-hidden rounded-2xl text-slate-800 ${glass}`}>
          <p className="px-3.5 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Jingle Brighton
          </p>
          <ul className="max-h-56 overflow-y-auto pb-1.5">
            {tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  className={`flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left text-xs cursor-pointer hover:bg-slate-900/5 ${
                    i === safeIndex ? 'font-semibold text-slate-950' : 'text-slate-700'
                  }`}
                >
                  <span className="w-3 text-[10px] tabular-nums text-slate-500">{i + 1}</span>
                  <span className="truncate">{t.title}</span>
                  {i === safeIndex && playing && <Equalizer />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mini ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setMiniMode(false)}
            aria-label={`Buka pemutar jingle${playing ? ' (sedang diputar)' : ''}`}
            title={current.title}
            className={`grid h-10 w-10 place-items-center rounded-full text-slate-700 cursor-pointer ${glass}`}
          >
            <Disc3
              className={`h-6 w-6 ${playing ? 'animate-[spin_3s_linear_infinite] motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>
      ) : (
        <div className={`relative flex items-center gap-1.5 overflow-hidden rounded-full py-1 pl-1 pr-1.5 text-slate-900 ${glass}`}>
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 h-px bg-slate-900/40 transition-[width] duration-300"
            style={{ width: `${progress * 100}%` }}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? 'Jeda jingle' : 'Putar jingle'}
            className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/70 ring-1 ring-slate-900/10 text-slate-800 hover:bg-white cursor-pointer"
          >
            <Disc3
              className={`absolute h-8 w-8 p-0.5 text-slate-400 ${playing ? 'animate-[spin_3s_linear_infinite] motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            <span className="relative grid h-4 w-4 place-items-center rounded-full bg-white text-slate-900">
              {playing ? <Pause className="h-2.5 w-2.5" /> : <Play className="h-2.5 w-2.5 translate-x-px" />}
            </span>
          </button>

          <div className="min-w-0 w-24 sm:w-32">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {playing ? 'Sedang diputar' : 'Jingle Brighton'}
            </p>
            <p className="truncate text-xs font-semibold" title={current.title}>
              {current.title}
            </p>
          </div>

          {playing && <Equalizer />}

          <button type="button" onClick={next} aria-label="Jingle berikutnya" className={iconBtn}>
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setListOpen((o) => !o)}
            aria-label="Daftar jingle"
            aria-expanded={listOpen}
            aria-controls="jingle-list"
            className={iconBtn}
          >
            {listOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ListMusic className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setListOpen(false);
              setMiniMode(true);
            }}
            aria-label="Kecilkan pemutar"
            title="Kecilkan"
            className={iconBtn}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

const Equalizer: React.FC = () => (
  <span aria-hidden="true" className="ml-auto flex h-3 items-end gap-0.5 shrink-0">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-0.5 rounded-full bg-slate-700 motion-safe:animate-[jingle-eq_0.9s_ease-in-out_infinite]"
        style={{ height: '100%', animationDelay: `${i * 0.18}s` }}
      />
    ))}
  </span>
);
