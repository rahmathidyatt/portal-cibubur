import React, { useEffect, useState } from 'react';
import { getBirthdayStore } from '../services/birthdayStore';
import { birthdayReminders, type AgentBirthday } from '../features/birthdays/birthdays';
import { BIRTHDAY_WISH_CHANGED, DEFAULT_BIRTHDAY_WISH, getBirthdayWish, type BirthdayWish } from '../services/settingsStore';
import { useLang } from '../i18n/lang';

/** "Vina (MHBX)" → "VINA (MHBX)". */
export function birthdayName(name: string): string {
  const m = name.match(/^(.*?)\s*(\([^)]*\))\s*$/);
  return m ? `${m[1].trim().toUpperCase()} ${m[2]}` : name.trim().toUpperCase();
}

/**
 * Ucapan ulang tahun agen di beranda: hari ini (ucapan lengkap) dan besok (H-1).
 * Tidak tampil bila tidak ada yang berulang tahun.
 */
export const BirthdayReminder: React.FC<{ today: string }> = ({ today }) => {
  const { lang } = useLang();
  const [list, setList] = useState<AgentBirthday[]>([]);
  const [wish, setWish] = useState<BirthdayWish>(DEFAULT_BIRTHDAY_WISH);

  useEffect(() => {
    let alive = true;
    getBirthdayStore()
      .list()
      .then((rows) => alive && setList(rows))
      .catch(() => alive && setList([]));
    const loadWish = () =>
      void getBirthdayWish().then((w) => {
        if (alive) setWish(w);
      });
    loadWish();
    window.addEventListener(BIRTHDAY_WISH_CHANGED, loadWish);
    return () => {
      alive = false;
      window.removeEventListener(BIRTHDAY_WISH_CHANGED, loadWish);
    };
  }, []);

  const { today: todayList, tomorrow } = birthdayReminders(list, today);
  if (todayList.length === 0 && tomorrow.length === 0) return null;
  const en = lang === 'en';

  return (
    <div
      role="note"
      aria-label="Ulang tahun agen"
      translate="no"
      className="notranslate mt-5 flex flex-col gap-1 rounded-xl bg-slate-100/80 px-4 py-3 ring-1 ring-slate-200/70 sm:flex-row sm:items-center sm:gap-4"
    >
      {todayList.length > 0 && (
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-bold text-slate-950">
            {en ? 'Happy Birthday' : 'Selamat Ulang Tahun'} {todayList.map((b) => birthdayName(b.name)).join(' & ')}
          </span>
          <span className="text-slate-600"> — {en ? wish.en : wish.id}</span>
        </p>
      )}
      {tomorrow.length > 0 && (
        <p className={`shrink-0 text-xs text-slate-500 ${todayList.length > 0 ? 'sm:border-l sm:border-slate-300 sm:pl-4' : ''}`}>
          <span className="font-semibold text-slate-800">{en ? 'Birthday tomorrow:' : 'Ulang tahun besok:'}</span>{' '}
          {tomorrow.map((b) => b.name).join(', ')}
        </p>
      )}
    </div>
  );
};
