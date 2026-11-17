import React from 'react';
import { BUSINESS_MANAGERS } from '../data/businessManagers';

// Foto di-import satu per satu agar Vite menyalin & meng-hash file saat build.
// Menambah BM baru: simpan foto 400x400 di src/assets/managers/<id>.webp, import di sini,
// lalu tambahkan datanya di src/data/businessManagers.ts.
import rudyPhoto from '../assets/managers/rudy.webp';
import adolfPhoto from '../assets/managers/adolf.webp';
import viraPhoto from '../assets/managers/vira.webp';
import edahPhoto from '../assets/managers/edah.webp';
import risdaPhoto from '../assets/managers/risda.webp';
import veePhoto from '../assets/managers/vee.webp';
import morenPhoto from '../assets/managers/moren.webp';
import adePhoto from '../assets/managers/ade.webp';
import toniPhoto from '../assets/managers/toni.webp';

const PHOTOS: Record<string, string> = {
  rudy: rudyPhoto,
  adolf: adolfPhoto,
  vira: viraPhoto,
  edah: edahPhoto,
  risda: risdaPhoto,
  vee: veePhoto,
  moren: morenPhoto,
  ade: adePhoto,
  toni: toniPhoto
};

function photoFor(id: string): string | undefined {
  return PHOTOS[id];
}

export const BusinessManagers: React.FC = () => (
  <section id="business-manager" className="scroll-mt-20 py-12 sm:py-16 bg-white border-b border-slate-200">
    <div className="max-w-[1140px] mx-auto px-4 sm:px-6">
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
        Business Manager
      </h2>

      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {BUSINESS_MANAGERS.map((bm) => {
          const photo = photoFor(bm.id);
          return (
            <li
              key={bm.id}
              className="flex items-center gap-4 bg-white border border-slate-200 rounded-2xl p-3"
            >
              {photo ? (
                <img
                  src={photo}
                  alt={`Foto ${bm.name}`}
                  width={400}
                  height={400}
                  loading="lazy"
                  decoding="async"
                  className="w-20 h-20 shrink-0 rounded-xl object-cover bg-amber-400"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="grid place-items-center w-20 h-20 shrink-0 rounded-xl bg-amber-400 text-2xl font-bold text-slate-950"
                >
                  {bm.name.charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-950 truncate">{bm.name}</p>
                <p className="mt-0.5 font-mono text-xs text-slate-500">{bm.code}</p>
                <p className="mt-1.5 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                  {bm.tier}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  </section>
);
