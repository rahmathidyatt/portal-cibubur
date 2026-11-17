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

  return (
    <div ref={rootRef} className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 max-w-[calc(100vw-1.5rem)]">
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
        <div
          id="jingle-list"
          className="mb-2 w-72 max-w-full overflow-hidden rounded-2xl bg-slate-950/95 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur"
        >
          <p className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-400">Jingle Brighton</p>
          <ul className="max-h-64 overflow-y-auto pb-2">
            {tracks.map((t, i) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => choose(i)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm cursor-pointer hover:bg-white/10 ${
                    i === safeIndex ? 'text-amber-300 font-semibold' : 'text-slate-200'
                  }`}
                >
                  <span className="w-4 text-xs tabular-nums text-slate-500">{i + 1}</span>
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
            className="relative grid h-12 w-12 place-items-center rounded-full bg-slate-950/95 shadow-xl ring-1 ring-white/10 cursor-pointer"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950">
              <Disc3
                className={`h-9 w-9 p-1 ${playing ? 'animate-[spin_3s_linear_infinite] motion-reduce:animate-none' : ''}`}
                aria-hidden="true"
              />
            </span>
          </button>
        </div>
      ) : (
      <div className="relative flex items-center gap-2 overflow-hidden rounded-full bg-slate-950/95 py-1.5 pl-1.5 pr-2 text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 h-0.5 bg-amber-400 transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? 'Jeda jingle' : 'Putar jingle'}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 cursor-pointer"
        >
          <Disc3
            className={`h-10 w-10 p-1 ${playing ? 'animate-[spin_3s_linear_infinite] motion-reduce:animate-none' : ''}`}
            aria-hidden="true"
          />
          <span className="absolute grid h-5 w-5 place-items-center rounded-full bg-slate-950 text-amber-300">
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 translate-x-px" />}
          </span>
        </button>

        <div className="min-w-0 w-32 sm:w-44">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-400">
            {playing ? 'Sedang diputar' : 'Jingle Brighton'}
          </p>
          <p className="truncate text-sm font-semibold" title={current.title}>
            {current.title}
          </p>
        </div>

        {playing && <Equalizer />}

        <button
          type="button"
          onClick={next}
          aria-label="Jingle berikutnya"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <SkipForward className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setListOpen(false);
            setMiniMode(true);
          }}
          aria-label="Kecilkan pemutar"
          title="Kecilkan"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setListOpen((o) => !o)}
          aria-label="Daftar jingle"
          aria-expanded={listOpen}
          aria-controls="jingle-list"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer"
        >
          {listOpen ? <ChevronDown className="h-4 w-4" /> : <ListMusic className="h-4 w-4" />}
        </button>
      </div>
      )}
    </div>
  );
};

const Equalizer: React.FC = () => (
  <span aria-hidden="true" className="ml-auto flex h-3.5 items-end gap-0.5 shrink-0">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-0.5 rounded-full bg-amber-400 motion-safe:animate-[jingle-eq_0.9s_ease-in-out_infinite]"
        style={{ height: '100%', animationDelay: `${i * 0.18}s` }}
      />
    ))}
  </span>
);
