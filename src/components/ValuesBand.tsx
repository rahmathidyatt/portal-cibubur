import React from 'react';

/** Nilai budaya Brighton (CHASE), dipasang di atas footer semua halaman. */
const VALUES: { letter: string; label: string; color: string }[] = [
  { letter: 'C', label: 'Continuous Improvement', color: 'text-neutral-400' },
  { letter: 'H', label: 'Harmony', color: 'text-neutral-500' },
  { letter: 'A', label: 'Agile', color: 'text-neutral-600' },
  { letter: 'S', label: 'Servanthood', color: 'text-neutral-700' },
  { letter: 'E', label: 'Excellent with Integrity', color: 'text-neutral-900' }
];

export const ValuesBand: React.FC = () => (
  <section
    translate="no"
    aria-label="Nilai Brighton: CHASE"
    className="notranslate relative overflow-hidden bg-gradient-to-r from-amber-50 via-amber-200 to-yellow-400"
  >
    {/* Di HP isi digeser ke kanan supaya tidak tertutup tombol bulat melayang di kiri bawah. */}
    <div
      className="relative max-w-[1140px] mx-auto pl-[68px] pr-3 py-4 sm:px-6 sm:py-9 flex flex-col-reverse items-center gap-2.5 md:flex-row md:justify-between md:gap-6"
    >
      <ul className="grid w-full grid-cols-5 gap-0.5 md:max-w-[720px] md:gap-4">
        {VALUES.map((v) => (
          <li key={v.letter} className={`flex min-w-0 flex-col items-center text-center ${v.color}`}>
            <span aria-hidden="true" className="font-display text-xl font-extrabold leading-none sm:text-5xl">
              {v.letter}
            </span>
            <span className="mt-1 text-[8.5px] font-bold leading-[1.15] tracking-tight sm:mt-2 sm:text-sm sm:tracking-normal">{v.label}</span>
          </li>
        ))}
      </ul>
      <span className="shrink-0 whitespace-nowrap font-display text-xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
        Bright<span className="text-white [text-shadow:0_0_1px_rgba(0,0,0,0.15)]">o</span>n
      </span>
    </div>
    {/* Titik-titik dekoratif di pojok kanan bawah */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-3 right-4 hidden h-7 w-32 opacity-80 sm:block [background-image:radial-gradient(circle,#fff_1.6px,transparent_1.8px)] [background-size:16px_14px]"
    />
  </section>
);
