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
    <div role="note" aria-label="Ulang tahun agen" translate="no" className="notranslate mt-3 space-y-2">
      {todayList.length > 0 && (
        <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200">
          <p className="text-base font-bold text-slate-950 sm:text-lg">
            {en ? 'Happy Birthday' : 'Selamat Ulang Tahun'} {todayList.map((b) => birthdayName(b.name)).join(' & ')}
          </p>
          <p className="mt-1 text-sm text-slate-600">{en ? wish.en : wish.id}</p>
        </div>
      )}
      {tomorrow.length > 0 && (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">{en ? 'Birthday tomorrow:' : 'Ulang tahun besok:'}</span>{' '}
          {tomorrow.map((b) => b.name).join(', ')}
        </p>
      )}
    </div>
  );
};
